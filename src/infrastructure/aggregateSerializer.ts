import { encode, decode } from "@msgpack/msgpack";
import { ProductAggregate } from "../domain/product/aggregate";
import { encryptField, decryptField } from "./utils/encryption";
import { hasZstdMagicBytes, COMPRESSION_THRESHOLD } from "./utils/compression";
import type { DomainAggregate } from "../domain/_base/aggregate";

type SerializedAggregate = readonly [
  string,
  string,
  number,
  readonly [number, readonly any[]]
];

type EntityClass = {
  new (params: any): any;
  stateFields?: readonly string[];
  encryptedFields?: string[];
  stateVersion?: number;
};

type AggregateClass = EntityClass;

const AGGREGATE_REGISTRY: Record<string, AggregateClass> = {
  product: ProductAggregate,
};

const ENTITY_REGISTRY: Record<string, EntityClass> = {};

export function registerTestAggregate(
  aggregateType: string,
  aggregateClass: AggregateClass
): void {
  AGGREGATE_REGISTRY[aggregateType] = aggregateClass;
}

export function registerTestEntity(
  entityType: string,
  entityClass: EntityClass
): void {
  ENTITY_REGISTRY[entityType] = entityClass;
}

// Helper to check if a value is registered in the entity registry
function isRegisteredEntity(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  const EntityClass = value.constructor;
  for (const registeredClass of Object.values(ENTITY_REGISTRY)) {
    if (registeredClass === EntityClass) {
      return true;
    }
  }
  return false;
}

// Helper to get entity type name from registry
function getEntityTypeName(entity: any): string | null {
  const EntityClass = entity.constructor;
  for (const [typeName, registeredClass] of Object.entries(ENTITY_REGISTRY)) {
    if (registeredClass === EntityClass) {
      return typeName;
    }
  }
  return null;
}

export class EntitySerializer {
  async serialize(entity: any): Promise<any> {
    const EntityClass = entity.constructor;
    if (!EntityClass.stateFields) {
      throw new Error(
        `Entity ${EntityClass.name} does not have stateFields defined`
      );
    }

    const entityType = getEntityTypeName(entity);
    if (!entityType) {
      throw new Error(
        `Entity ${EntityClass.name} is not registered in ENTITY_REGISTRY`
      );
    }

    const stateArray = [];
    const encryptedFields = EntityClass.encryptedFields || [];

    for (let i = 0; i < EntityClass.stateFields.length; i++) {
      const fieldName = EntityClass.stateFields[i];
      if (!fieldName) continue;

      let value = (entity as any)[fieldName];

      // Handle encryption
      if (encryptedFields.includes(fieldName) && value !== undefined) {
        value = await encryptField(value);
      }

      stateArray.push(value);
    }

    // Return [entityType, stateVersion, stateArray]
    return [entityType, EntityClass.stateVersion || 1, stateArray];
  }

  async deserialize(
    serializedData: readonly [string, number, readonly any[]]
  ): Promise<any> {
    const [entityType, stateVersion, stateArray] = serializedData;

    const EntityClass = ENTITY_REGISTRY[entityType];
    if (!EntityClass) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    if (!EntityClass.stateFields) {
      throw new Error(`Entity ${entityType} does not have stateFields defined`);
    }

    const state: any = {};
    const encryptedFields = EntityClass.encryptedFields || [];

    for (let i = 0; i < EntityClass.stateFields.length; i++) {
      const fieldName = EntityClass.stateFields[i];
      if (!fieldName) continue;

      let value = stateArray[i];

      // Handle decryption
      if (
        encryptedFields.includes(fieldName) &&
        value !== undefined &&
        value !== null
      ) {
        value = await decryptField(value);
      }

      // Convert null to undefined
      state[fieldName] = value === null ? undefined : value;
    }

    return new EntityClass(state);
  }
}

export class AggregateSerializer {
  private entitySerializer: EntitySerializer;

  constructor() {
    this.entitySerializer = new EntitySerializer();
  }

  async serialize(aggregate: any, aggregateType: string): Promise<Buffer> {
    const AggregateClass = AGGREGATE_REGISTRY[aggregateType];
    if (!AggregateClass) {
      throw new Error(`Unknown aggregate type: ${aggregateType}`);
    }

    if (!AggregateClass.stateFields) {
      throw new Error(
        `Aggregate ${aggregateType} does not have stateFields defined`
      );
    }

    // Convert aggregate state to array based on field order
    const stateArray = [];
    const encryptedFields = AggregateClass.encryptedFields || [];

    for (let i = 0; i < AggregateClass.stateFields.length; i++) {
      const fieldName = AggregateClass.stateFields[i];
      if (!fieldName) continue;

      let value = (aggregate as any)[fieldName];

      // Handle nested entities using EntitySerializer
      if (isRegisteredEntity(value)) {
        value = await this.entitySerializer.serialize(value);
      } else if (
        Array.isArray(value) &&
        value.length > 0 &&
        isRegisteredEntity(value[0])
      ) {
        value = await Promise.all(
          value.map((item) => this.entitySerializer.serialize(item))
        );
      }

      // Handle encryption for specific fields
      if (encryptedFields.includes(fieldName) && value !== undefined) {
        value = await encryptField(value);
      }

      stateArray.push(value);
    }

    const serializedState = [AggregateClass.stateVersion || 1, stateArray];

    const arrayFormat = [
      aggregateType,
      aggregate.id,
      aggregate.version,
      serializedState,
    ];

    const encoded = encode(arrayFormat);

    // Apply zstd compression if payload is >= 4KB
    if (encoded.byteLength >= COMPRESSION_THRESHOLD) {
      const compressed = Bun.zstdCompressSync(encoded, { level: 1 });
      return compressed;
    }

    return Buffer.from(encoded);
  }

  async deserialize(data: Buffer): Promise<DomainAggregate> {
    // Check for zstd compression and decompress if needed
    let decodedData = data;
    if (hasZstdMagicBytes(data)) {
      decodedData = Bun.zstdDecompressSync(data);
    }

    const [aggregateType, aggregateId, version, rawState] = decode(
      decodedData
    ) as SerializedAggregate;

    const AggregateClass = AGGREGATE_REGISTRY[aggregateType];
    if (!AggregateClass) {
      throw new Error(`Unknown aggregate type: ${aggregateType}`);
    }

    if (!AggregateClass.stateFields) {
      throw new Error(
        `Aggregate ${aggregateType} does not have stateFields defined`
      );
    }

    // Array-based state with versioning
    const [stateVersion, stateArray] = rawState as [number, any[]];

    // Convert array back to object based on field order
    const state: any = {};
    const encryptedFields = AggregateClass.encryptedFields || [];

    for (let i = 0; i < AggregateClass.stateFields.length; i++) {
      const fieldName = AggregateClass.stateFields[i];
      if (!fieldName) continue;

      let value = stateArray[i];

      // Handle decryption for specific fields
      if (
        encryptedFields.includes(fieldName) &&
        value !== undefined &&
        value !== null
      ) {
        value = await decryptField(value);
      }

      // Handle nested entities using EntitySerializer - check if it's in serialized format [entityType, version, array]
      if (
        Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] === "string" &&
        typeof value[1] === "number" &&
        Array.isArray(value[2])
      ) {
        value = await this.entitySerializer.deserialize(
          value as [string, number, readonly any[]]
        );
      } else if (
        Array.isArray(value) &&
        value.length > 0 &&
        Array.isArray(value[0]) &&
        value[0].length === 3 &&
        typeof value[0][0] === "string"
      ) {
        // Array of serialized entities
        value = await Promise.all(
          value.map((item) =>
            this.entitySerializer.deserialize(
              item as [string, number, readonly any[]]
            )
          )
        );
      }

      // Convert null to undefined for missing fields
      state[fieldName] = value === null ? undefined : value;
    }

    return new AggregateClass(state);
  }
}
