import { describe, expect, test } from "bun:test";
import {
  EventSerializer,
  registerTestEvent,
} from "../../../src/infrastructure/eventSerializer";
import {
  ProductCreatedEvent,
  ProductArchivedEvent,
} from "../../../src/domain/product/events";
import { decode } from "@msgpack/msgpack";
import { decryptField } from "../../../src/infrastructure/utils/encryption";
import type { DomainEvent } from "../../../src/domain/_base/domainEvent";

// Test event with encrypted fields for testing purposes
type TestEventWithEncryptionPayload = {
  publicData: string;
  sensitiveData: string;
  morePublicData: number;
};

class TestEventWithEncryption
  implements
    DomainEvent<"TestEventWithEncryption", TestEventWithEncryptionPayload>
{
  static payloadFields = [
    "publicData",
    "sensitiveData",
    "morePublicData",
  ] as const;
  static payloadVersion = 1;
  static encryptedFields = ["sensitiveData"];

  createdAt: Date;
  eventName = "TestEventWithEncryption" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: TestEventWithEncryptionPayload;
  committed: boolean;

  constructor({
    createdAt,
    aggregateId,
    correlationId,
    version,
    payload,
    committed,
  }: {
    createdAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: TestEventWithEncryptionPayload;
    committed: boolean;
  }) {
    this.createdAt = createdAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
    this.committed = committed;
  }
}

// Register the test event
registerTestEvent("TestEventWithEncryption", TestEventWithEncryption);

describe("EventSerializer", () => {
  const serializer = new EventSerializer();

  describe("Event without encrypted fields", () => {
    test("should serialize and deserialize event correctly", async () => {
      const event = new ProductArchivedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {},
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.eventName).toBe("ProductArchived");
      expect(deserialized.aggregateId).toBe("product-123");
      expect(deserialized.correlationId).toBe("correlation-456");
      expect(deserialized.version).toBe(1);
      expect(deserialized.createdAt.getTime()).toBe(
        new Date("2024-01-15T10:30:00.000Z").getTime()
      );
      expect(deserialized.payload).toEqual({});
      expect(deserialized.committed).toBe(true);
    });

    test("should keep payload fields in plaintext msgpack", async () => {
      const event = new ProductArchivedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {},
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const decoded = decode(serialized) as any[];

      // Verify the structure: [eventName, createdAt, correlationId, aggregateId, version, payload]
      expect(decoded[0]).toBe("ProductArchived");
      expect(decoded[3]).toBe("product-123");
      // Payload is [version, fields] where fields is empty array for ProductArchived
      expect(decoded[5]).toEqual([1, []]);
    });
  });

  describe("Event with encrypted fields", () => {
    test("should serialize and deserialize event with encrypted fields correctly", async () => {
      const event = new TestEventWithEncryption({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          publicData: "This is public",
          sensitiveData: "This is sensitive and should be encrypted",
          morePublicData: 42,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.eventName).toBe("TestEventWithEncryption");
      expect(deserialized.aggregateId).toBe("test-123");
      expect(deserialized.correlationId).toBe("correlation-456");
      expect(deserialized.version).toBe(1);
      expect(deserialized.payload.publicData).toBe("This is public");
      expect(deserialized.payload.sensitiveData).toBe(
        "This is sensitive and should be encrypted"
      );
      expect(deserialized.payload.morePublicData).toBe(42);
      expect(deserialized.committed).toBe(true);
    });

    test("should encrypt specified fields in serialized data", async () => {
      const event = new TestEventWithEncryption({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          publicData: "This is public",
          sensitiveData: "This is sensitive and should be encrypted",
          morePublicData: 42,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const decoded = decode(serialized) as any[];
      const payload = decoded[5] as any;

      // Payload is [version, fields]
      const [version, fields] = payload;
      // payloadFields order: ["publicData", "sensitiveData", "morePublicData"]
      const [publicData, sensitiveData, morePublicData] = fields;

      // The sensitiveData field should be encrypted (base64 string, not the original value)
      expect(sensitiveData).not.toBe(
        "This is sensitive and should be encrypted"
      );
      expect(typeof sensitiveData).toBe("string");
      expect(sensitiveData.length).toBeGreaterThan(50); // encrypted values are longer

      // Non-encrypted fields should remain in plaintext
      expect(publicData).toBe("This is public");
      expect(morePublicData).toBe(42);
    });

    test("should be able to decrypt encrypted field directly", async () => {
      const event = new TestEventWithEncryption({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          publicData: "This is public",
          sensitiveData: "This is sensitive and should be encrypted",
          morePublicData: 42,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const decoded = decode(serialized) as any[];
      const payload = decoded[5] as any;

      // Payload is [version, fields]
      const [version, fields] = payload;
      // payloadFields order: ["publicData", "sensitiveData", "morePublicData"]
      const [publicData, sensitiveData, morePublicData] = fields;

      // Manually decrypt the field
      const decryptedSensitiveData = await decryptField(sensitiveData);
      expect(decryptedSensitiveData).toBe(
        "This is sensitive and should be encrypted"
      );
    });

    test("should handle events with missing encrypted fields gracefully", async () => {
      const event = new TestEventWithEncryption({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        // @ts-expect-error - sensitiveData is missing
        payload: {
          publicData: "This is public",
          morePublicData: 42,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.payload.publicData).toBe("This is public");
      expect(deserialized.payload.sensitiveData).toBeUndefined();
      expect(deserialized.payload.morePublicData).toBe(42);
    });
  });

  describe("Error handling", () => {
    test("should throw error for unknown event type during serialization", async () => {
      const unknownEvent = {
        eventName: "UnknownEvent",
        createdAt: new Date(),
        aggregateId: "test-123",
        correlationId: "corr-123",
        version: 1,
        payload: {},
        committed: true,
      };

      await expect(serializer.serialize(unknownEvent as any)).rejects.toThrow(
        "Unknown event type: UnknownEvent"
      );
    });

    test("should throw error for unknown event name during deserialization", async () => {
      const invalidData = new Uint8Array([
        0x96, 0xac, 0x55, 0x6e, 0x6b, 0x6e, 0x6f, 0x77, 0x6e, 0x45, 0x76, 0x65,
        0x6e, 0x74, 0xce, 0x65, 0xd4, 0x5f, 0x90, 0xa0, 0xa0, 0x01, 0x80,
      ]); // msgpack encoded array with "UnknownEvent"

      await expect(serializer.deserialize(invalidData)).rejects.toThrow(
        "Unknown event name: UnknownEvent"
      );
    });
  });

  describe("Round-trip tests", () => {
    test("should preserve all data types through serialize/deserialize cycle", async () => {
      const event = new TestEventWithEncryption({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 5,
        payload: {
          publicData: "Complex data with 数字 and émojis 🔒",
          sensitiveData: "Sensitive data with 数字 and émojis 🔒",
          morePublicData: 999,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.eventName).toBe(event.eventName);
      expect(deserialized.aggregateId).toBe(event.aggregateId);
      expect(deserialized.correlationId).toBe(event.correlationId);
      expect(deserialized.version).toBe(event.version);
      expect(deserialized.createdAt.getTime()).toBe(event.createdAt.getTime());
      expect(deserialized.payload).toEqual(event.payload);
      expect(deserialized.committed).toBe(event.committed);
    });

    test("should handle multiple serialize/deserialize cycles", async () => {
      const originalEvent = new TestEventWithEncryption({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          publicData: "This is public",
          sensitiveData: "This is sensitive",
          morePublicData: 42,
        },
        committed: true,
      });

      // First cycle
      const serialized1 = await serializer.serialize(originalEvent);
      const deserialized1 = await serializer.deserialize(serialized1);

      // Second cycle
      const serialized2 = await serializer.serialize(deserialized1);
      const deserialized2 = await serializer.deserialize(serialized2);

      // Third cycle
      const serialized3 = await serializer.serialize(deserialized2);
      const deserialized3 = await serializer.deserialize(serialized3);

      // Verify data integrity after multiple cycles
      expect(deserialized3.payload).toEqual(originalEvent.payload);
      expect(deserialized3.aggregateId).toBe(originalEvent.aggregateId);
      expect(deserialized3.version).toBe(originalEvent.version);
    });
  });

  describe("Array-based payload serialization", () => {
    test("should serialize and deserialize ProductCreatedEvent with array-based payload", async () => {
      const event = new ProductCreatedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Test Product",
          description: "This is a test product",
          slug: "test-product",
          collectionIds: ["col-1", "col-2"],
          variantIds: ["var-1", "var-2"],
          archived: false,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.eventName).toBe("ProductCreated");
      expect(deserialized.aggregateId).toBe("product-123");
      expect(deserialized.correlationId).toBe("correlation-456");
      expect(deserialized.version).toBe(1);
      expect(deserialized.payload.title).toBe("Test Product");
      expect(deserialized.payload.description).toBe("This is a test product");
      expect(deserialized.payload.slug).toBe("test-product");
      expect(deserialized.payload.collectionIds).toEqual(["col-1", "col-2"]);
      expect(deserialized.payload.variantIds).toEqual(["var-1", "var-2"]);
      expect(deserialized.payload.archived).toBe(false);
      expect(deserialized.committed).toBe(true);
    });

    test("should serialize payload as array with version information", async () => {
      const event = new ProductCreatedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Test Product",
          description: "This is a test product",
          slug: "test-product",
          collectionIds: ["col-1"],
          variantIds: ["var-1"],
          archived: false,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const decoded = decode(serialized) as any[];
      const payload = decoded[5];

      // Payload should be an array: [version, fields]
      expect(Array.isArray(payload)).toBe(true);
      expect(payload[0]).toBe(1); // version
      expect(Array.isArray(payload[1])).toBe(true); // fields array
      expect(payload[1]).toEqual([
        "Test Product",
        "This is a test product",
        "test-product",
        ["col-1"],
        ["var-1"],
        false,
      ]);
    });

    test("should handle backwards compatibility with extra fields", async () => {
      // Simulate a newer version of ProductCreatedEvent with an extra field
      class ProductCreatedEventV2 {
        static payloadFields = [
          "title",
          "description",
          "slug",
          "collectionIds",
          "variantIds",
          "archived",
          "newField", // New field added at the end
        ] as const;

        static payloadVersion = 2;

        createdAt: Date;
        eventName = "ProductCreatedV2" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      // Register the v2 event
      registerTestEvent("ProductCreatedV2", ProductCreatedEventV2);

      const event = new ProductCreatedEventV2({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Test Product",
          description: "This is a test product",
          slug: "test-product",
          collectionIds: ["col-1"],
          variantIds: ["var-1"],
          archived: false,
          newField: "This is a new field",
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      // Should deserialize correctly with all fields
      expect(deserialized.eventName).toBe("ProductCreatedV2");
      expect(deserialized.payload.title).toBe("Test Product");
      expect(deserialized.payload.newField).toBe("This is a new field");
    });

    test("should handle missing fields gracefully", async () => {
      const event = new ProductCreatedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        // @ts-expect-error - description is missing to test undefined handling
        payload: {
          title: "Test Product",
          slug: "test-product",
          collectionIds: [],
          variantIds: [],
          archived: false,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.payload.title).toBe("Test Product");
      expect(deserialized.payload.description).toBeUndefined();
      expect(deserialized.payload.slug).toBe("test-product");
    });

    test("should preserve data types through array serialization", async () => {
      const event = new ProductCreatedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "product-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Complex Product with 数字 and émojis 🔒",
          description: "Description with special chars: !@#$%^&*()",
          slug: "complex-product",
          collectionIds: ["col-1", "col-2", "col-3"],
          variantIds: [],
          archived: true,
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      expect(deserialized.payload.title).toBe(
        "Complex Product with 数字 and émojis 🔒"
      );
      expect(deserialized.payload.description).toBe(
        "Description with special chars: !@#$%^&*()"
      );
      expect(deserialized.payload.collectionIds).toEqual([
        "col-1",
        "col-2",
        "col-3",
      ]);
      expect(deserialized.payload.variantIds).toEqual([]);
      expect(deserialized.payload.archived).toBe(true);
    });
  });

  describe("Schema evolution and versioning", () => {
    test("should handle field renaming without version bump", async () => {
      // Create an event with original field names
      class OriginalEvent {
        static payloadFields = ["title", "description", "slug"] as const;
        static payloadVersion = 1;

        createdAt: Date;
        eventName = "OriginalEvent" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      // Register the original event
      registerTestEvent("OriginalEvent", OriginalEvent);

      const originalEvent = new OriginalEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Test Product",
          description: "This is a test product",
          slug: "test-product",
        },
        committed: true,
      });

      // Serialize with original schema
      const serialized = await serializer.serialize(originalEvent);

      // Now "rename" the field by changing the schema (but keeping same position)
      class RenamedEvent {
        static payloadFields = ["title", "notDescription", "slug"] as const; // Renamed!
        static payloadVersion = 1; // Same version

        createdAt: Date;
        eventName = "RenamedEvent" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      // Register the renamed event
      registerTestEvent("RenamedEvent", RenamedEvent);

      // Deserialize the old event with new schema
      // We need to register the renamed event with the same event name as the original
      registerTestEvent("OriginalEvent", RenamedEvent);
      const deserialized = await serializer.deserialize(serialized);

      // Should work! The value at position 1 gets mapped to the new field name
      expect(deserialized.payload.title).toBe("Test Product");
      expect(deserialized.payload.notDescription).toBe(
        "This is a test product"
      ); // Renamed field
      expect(deserialized.payload.slug).toBe("test-product");
    });

    test("should handle adding fields with version bump", async () => {
      // Version 1: Original schema
      class ProductEventV1 {
        static payloadFields = ["title", "description"] as const;
        static payloadVersion = 1;

        createdAt: Date;
        eventName = "ProductEventV1" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      registerTestEvent("ProductEventV1", ProductEventV1);

      const v1Event = new ProductEventV1({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Test Product",
          description: "This is a test product",
        },
        committed: true,
      });

      // Serialize with v1 schema
      const serialized = await serializer.serialize(v1Event);

      // Version 2: Added fields
      class ProductEventV2 {
        static payloadFields = [
          "title",
          "description",
          "category",
          "tags",
        ] as const;
        static payloadVersion = 2; // Bumped!

        createdAt: Date;
        eventName = "ProductEventV2" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      registerTestEvent("ProductEventV2", ProductEventV2);

      // Deserialize old v1 event with new v2 schema
      const deserialized = await serializer.deserialize(serialized);

      // Should work with undefined for new fields
      expect(deserialized.payload.title).toBe("Test Product");
      expect(deserialized.payload.description).toBe("This is a test product");
      expect(deserialized.payload.category).toBeUndefined(); // New field
      expect(deserialized.payload.tags).toBeUndefined(); // New field
    });

    test("should preserve version information in serialized data", async () => {
      class VersionedEvent {
        static payloadFields = ["title", "description"] as const;
        static payloadVersion = 3; // Specific version

        createdAt: Date;
        eventName = "VersionedEvent" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      registerTestEvent("VersionedEvent", VersionedEvent);

      const event = new VersionedEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        payload: {
          title: "Test Product",
          description: "This is a test product",
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const decoded = decode(serialized) as any[];
      const payload = decoded[5];

      // Should preserve the version number
      expect(payload[0]).toBe(3); // payloadVersion
      expect(payload[1]).toEqual(["Test Product", "This is a test product"]); // fields array
    });

    test("should handle missing fields gracefully during schema evolution", async () => {
      // Create an event with some fields missing
      class IncompleteEvent {
        static payloadFields = [
          "title",
          "description",
          "category",
          "tags",
        ] as const;
        static payloadVersion = 1;

        createdAt: Date;
        eventName = "IncompleteEvent" as const;
        correlationId: string;
        aggregateId: string;
        version: number;
        payload: any;
        committed: boolean;

        constructor(params: any) {
          this.createdAt = params.createdAt;
          this.correlationId = params.correlationId;
          this.aggregateId = params.aggregateId;
          this.version = params.version;
          this.payload = params.payload;
          this.committed = params.committed;
        }
      }

      registerTestEvent("IncompleteEvent", IncompleteEvent);

      const event = new IncompleteEvent({
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        aggregateId: "test-123",
        correlationId: "correlation-456",
        version: 1,
        // Missing category and tags
        payload: {
          title: "Test Product",
          description: "This is a test product",
        },
        committed: true,
      });

      const serialized = await serializer.serialize(event);
      const deserialized = await serializer.deserialize(serialized);

      // Should handle missing fields gracefully
      expect(deserialized.payload.title).toBe("Test Product");
      expect(deserialized.payload.description).toBe("This is a test product");
      expect(deserialized.payload.category).toBeUndefined();
      expect(deserialized.payload.tags).toBeUndefined();
    });
  });
});
