import { describe, expect, test } from "bun:test";
import {
  AggregateSerializer,
  EntitySerializer,
  registerTestAggregate,
  registerTestEntity,
} from "../../../src/infrastructure/aggregateSerializer";
import { decode } from "@msgpack/msgpack";
import { decryptField } from "../../../src/infrastructure/utils/encryption";

// Test entity without encrypted fields
class FakeVariantEntity {
  static readonly stateFields = ["id", "sku", "price", "inventory"] as const;
  static readonly encryptedFields: string[] = [];
  static readonly stateVersion = 1;

  id: string;
  sku: string;
  price: number;
  inventory: number;

  constructor({
    id,
    sku,
    price,
    inventory,
  }: {
    id: string;
    sku: string;
    price: number;
    inventory: number;
  }) {
    this.id = id;
    this.sku = sku;
    this.price = price;
    this.inventory = inventory;
  }
}

// Test entity with encrypted fields
class FakePaymentEntity {
  static readonly stateFields = [
    "id",
    "amount",
    "cardNumber",
    "currency",
  ] as const;
  static readonly encryptedFields = ["cardNumber"];
  static readonly stateVersion = 1;

  id: string;
  amount: number;
  cardNumber: string;
  currency: string;

  constructor({
    id,
    amount,
    cardNumber,
    currency,
  }: {
    id: string;
    amount: number;
    cardNumber: string;
    currency: string;
  }) {
    this.id = id;
    this.amount = amount;
    this.cardNumber = cardNumber;
    this.currency = currency;
  }
}

// Test aggregate without nested entities
class FakeOrderAggregate {
  static readonly stateFields = [
    "id",
    "correlationId",
    "version",
    "customerId",
    "status",
    "total",
    "createdAt",
  ] as const;
  static readonly encryptedFields: string[] = [];
  static readonly stateVersion = 1;

  id: string;
  correlationId: string;
  version: number;
  customerId: string;
  status: string;
  total: number;
  createdAt: Date;

  constructor({
    id,
    correlationId,
    version,
    customerId,
    status,
    total,
    createdAt,
  }: {
    id: string;
    correlationId: string;
    version: number;
    customerId: string;
    status: string;
    total: number;
    createdAt: Date;
  }) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.customerId = customerId;
    this.status = status;
    this.total = total;
    this.createdAt = createdAt;
  }
}

// Test aggregate with encrypted fields
class FakeUserAggregate {
  static readonly stateFields = [
    "id",
    "correlationId",
    "version",
    "email",
    "passwordHash",
    "firstName",
    "lastName",
  ] as const;
  static readonly encryptedFields = ["passwordHash"];
  static readonly stateVersion = 1;

  id: string;
  correlationId: string;
  version: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;

  constructor({
    id,
    correlationId,
    version,
    email,
    passwordHash,
    firstName,
    lastName,
  }: {
    id: string;
    correlationId: string;
    version: number;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.email = email;
    this.passwordHash = passwordHash;
    this.firstName = firstName;
    this.lastName = lastName;
  }
}

// Test aggregate with single nested entity
class FakeProductAggregateWithVariant {
  static readonly stateFields = [
    "id",
    "correlationId",
    "version",
    "title",
    "slug",
    "mainVariant",
  ] as const;
  static readonly encryptedFields: string[] = [];
  static readonly stateVersion = 1;

  id: string;
  correlationId: string;
  version: number;
  title: string;
  slug: string;
  mainVariant: FakeVariantEntity;

  constructor({
    id,
    correlationId,
    version,
    title,
    slug,
    mainVariant,
  }: {
    id: string;
    correlationId: string;
    version: number;
    title: string;
    slug: string;
    mainVariant: FakeVariantEntity;
  }) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.title = title;
    this.slug = slug;
    this.mainVariant = mainVariant;
  }
}

// Test aggregate with array of nested entities
class FakeCatalogAggregate {
  static readonly stateFields = [
    "id",
    "correlationId",
    "version",
    "name",
    "variants",
  ] as const;
  static readonly encryptedFields: string[] = [];
  static readonly stateVersion = 1;

  id: string;
  correlationId: string;
  version: number;
  name: string;
  variants: FakeVariantEntity[];

  constructor({
    id,
    correlationId,
    version,
    name,
    variants,
  }: {
    id: string;
    correlationId: string;
    version: number;
    name: string;
    variants: FakeVariantEntity[];
  }) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.name = name;
    this.variants = variants;
  }
}

// Register test aggregates and entities
registerTestAggregate("order", FakeOrderAggregate);
registerTestAggregate("user", FakeUserAggregate);
registerTestAggregate("productWithVariant", FakeProductAggregateWithVariant);
registerTestAggregate("catalog", FakeCatalogAggregate);
registerTestEntity("variant", FakeVariantEntity);
registerTestEntity("payment", FakePaymentEntity);

describe("AggregateSerializer", () => {
  const serializer = new AggregateSerializer();

  describe("Aggregate without nested entities or encrypted fields", () => {
    test("should serialize and deserialize aggregate correctly", async () => {
      // Arrange
      const aggregate = new FakeOrderAggregate({
        id: "order-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 5,
        customerId: "customer-uuid-789",
        status: "pending",
        total: 99.99,
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "order");
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("order-uuid-123");
      expect(deserialized.correlationId).toBe("correlation-uuid-456");
      expect(deserialized.version).toBe(5);
      expect(deserialized.customerId).toBe("customer-uuid-789");
      expect(deserialized.status).toBe("pending");
      expect(deserialized.total).toBe(99.99);
      expect(deserialized.createdAt.getTime()).toBe(
        new Date("2024-01-15T10:30:00.000Z").getTime()
      );
    });

    test("should keep aggregate fields in plaintext msgpack", async () => {
      // Arrange
      const aggregate = new FakeOrderAggregate({
        id: "order-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 5,
        customerId: "customer-uuid-789",
        status: "pending",
        total: 99.99,
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "order");
      const decoded = decode(serialized) as any[];

      // Assert
      // Verify the structure: [aggregateType, aggregateId, version, [stateVersion, stateArray]]
      expect(decoded[0]).toBe("order");
      expect(decoded[1]).toBe("order-uuid-123");
      expect(decoded[2]).toBe(5);
      expect(decoded[3][0]).toBe(1); // stateVersion
      expect(Array.isArray(decoded[3][1])).toBe(true); // stateArray
    });
  });

  describe("Aggregate with encrypted fields", () => {
    test("should serialize and deserialize aggregate with encrypted fields correctly", async () => {
      // Arrange
      const aggregate = new FakeUserAggregate({
        id: "user-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 3,
        email: "test@example.com",
        passwordHash: "super-secret-hash-12345",
        firstName: "John",
        lastName: "Doe",
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "user");
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("user-uuid-123");
      expect(deserialized.email).toBe("test@example.com");
      expect(deserialized.passwordHash).toBe("super-secret-hash-12345");
      expect(deserialized.firstName).toBe("John");
      expect(deserialized.lastName).toBe("Doe");
      expect(deserialized.version).toBe(3);
    });

    test("should encrypt specified fields in serialized data", async () => {
      // Arrange
      const aggregate = new FakeUserAggregate({
        id: "user-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 3,
        email: "test@example.com",
        passwordHash: "super-secret-hash-12345",
        firstName: "John",
        lastName: "Doe",
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "user");
      const decoded = decode(serialized) as any[];
      const [stateVersion, stateArray] = decoded[3];

      // Assert
      // stateFields order: ["id", "correlationId", "version", "email", "passwordHash", "firstName", "lastName"]
      const [
        id,
        correlationId,
        version,
        email,
        passwordHash,
        firstName,
        lastName,
      ] = stateArray;

      // The passwordHash field should be encrypted (not the original value)
      expect(passwordHash).not.toBe("super-secret-hash-12345");
      expect(typeof passwordHash).toBe("string");
      expect(passwordHash.length).toBeGreaterThan(50); // encrypted values are longer

      // Non-encrypted fields should remain in plaintext
      expect(id).toBe("user-uuid-123");
      expect(email).toBe("test@example.com");
      expect(firstName).toBe("John");
      expect(lastName).toBe("Doe");
    });

    test("should be able to decrypt encrypted field directly", async () => {
      // Arrange
      const aggregate = new FakeUserAggregate({
        id: "user-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 3,
        email: "test@example.com",
        passwordHash: "super-secret-hash-12345",
        firstName: "John",
        lastName: "Doe",
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "user");
      const decoded = decode(serialized) as any[];
      const [stateVersion, stateArray] = decoded[3];
      const passwordHash = stateArray[4]; // passwordHash is at index 4

      // Assert
      const decryptedPasswordHash = await decryptField(passwordHash);
      expect(decryptedPasswordHash).toBe("super-secret-hash-12345");
    });
  });

  describe("Aggregate with single nested entity", () => {
    test("should serialize and deserialize aggregate with nested entity correctly", async () => {
      // Arrange
      const variant = new FakeVariantEntity({
        id: "variant-uuid-111",
        sku: "SKU-001",
        price: 49.99,
        inventory: 100,
      });

      const aggregate = new FakeProductAggregateWithVariant({
        id: "product-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 2,
        title: "Test Product",
        slug: "test-product",
        mainVariant: variant,
      });

      // Act
      const serialized = await serializer.serialize(
        aggregate,
        "productWithVariant"
      );
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("product-uuid-123");
      expect(deserialized.title).toBe("Test Product");
      expect(deserialized.slug).toBe("test-product");
      expect(deserialized.mainVariant).toBeInstanceOf(FakeVariantEntity);
      expect(deserialized.mainVariant.id).toBe("variant-uuid-111");
      expect(deserialized.mainVariant.sku).toBe("SKU-001");
      expect(deserialized.mainVariant.price).toBe(49.99);
      expect(deserialized.mainVariant.inventory).toBe(100);
    });

    test("should serialize nested entity in correct format", async () => {
      // Arrange
      const variant = new FakeVariantEntity({
        id: "variant-uuid-111",
        sku: "SKU-001",
        price: 49.99,
        inventory: 100,
      });

      const aggregate = new FakeProductAggregateWithVariant({
        id: "product-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 2,
        title: "Test Product",
        slug: "test-product",
        mainVariant: variant,
      });

      // Act
      const serialized = await serializer.serialize(
        aggregate,
        "productWithVariant"
      );
      const decoded = decode(serialized) as any[];
      const [stateVersion, stateArray] = decoded[3];

      // Assert
      // stateFields order: ["id", "correlationId", "version", "title", "slug", "mainVariant"]
      const mainVariantSerialized = stateArray[5];

      // Should be [entityType, version, array]
      expect(Array.isArray(mainVariantSerialized)).toBe(true);
      expect(mainVariantSerialized[0]).toBe("variant"); // entity type
      expect(mainVariantSerialized[1]).toBe(1); // entity version
      expect(mainVariantSerialized[2]).toEqual([
        "variant-uuid-111",
        "SKU-001",
        49.99,
        100,
      ]);
    });
  });

  describe("Aggregate with array of nested entities", () => {
    test("should serialize and deserialize aggregate with nested entity array correctly", async () => {
      // Arrange
      const variant1 = new FakeVariantEntity({
        id: "variant-uuid-111",
        sku: "SKU-001",
        price: 49.99,
        inventory: 100,
      });

      const variant2 = new FakeVariantEntity({
        id: "variant-uuid-222",
        sku: "SKU-002",
        price: 59.99,
        inventory: 50,
      });

      const aggregate = new FakeCatalogAggregate({
        id: "catalog-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 1,
        name: "Test Catalog",
        variants: [variant1, variant2],
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "catalog");
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("catalog-uuid-123");
      expect(deserialized.name).toBe("Test Catalog");
      expect(deserialized.variants).toHaveLength(2);
      expect(deserialized.variants[0]).toBeInstanceOf(FakeVariantEntity);
      expect(deserialized.variants[0].id).toBe("variant-uuid-111");
      expect(deserialized.variants[0].sku).toBe("SKU-001");
      expect(deserialized.variants[1]).toBeInstanceOf(FakeVariantEntity);
      expect(deserialized.variants[1].id).toBe("variant-uuid-222");
      expect(deserialized.variants[1].sku).toBe("SKU-002");
    });

    test("should handle empty entity array", async () => {
      // Arrange
      const aggregate = new FakeCatalogAggregate({
        id: "catalog-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 1,
        name: "Empty Catalog",
        variants: [],
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "catalog");
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.variants).toEqual([]);
    });
  });

  describe("Error handling", () => {
    test("should throw error for unknown aggregate type during serialization", async () => {
      // Arrange
      const aggregate = {
        id: "unknown-123",
        version: 1,
      };

      // Act & Assert
      await expect(
        serializer.serialize(aggregate, "unknownType")
      ).rejects.toThrow("Unknown aggregate type: unknownType");
    });

    test("should throw error for unknown aggregate type during deserialization", async () => {
      // Arrange
      const { encode } = await import("@msgpack/msgpack");
      // Create msgpack data with unknown aggregate type
      const invalidData = encode([
        "unknownType",
        "aggregate-id-123",
        5,
        [1, ["field1", "field2"]],
      ]);

      // Act & Assert
      await expect(serializer.deserialize(invalidData)).rejects.toThrow(
        "Unknown aggregate type: unknownType"
      );
    });

    test("should throw error for aggregate without stateFields during serialization", async () => {
      // Arrange
      class InvalidAggregate {
        id: string;
        constructor(id: string) {
          this.id = id;
        }
      }
      registerTestAggregate("invalid", InvalidAggregate as any);

      const aggregate = new InvalidAggregate("test-123");

      // Act & Assert
      await expect(serializer.serialize(aggregate, "invalid")).rejects.toThrow(
        "Aggregate invalid does not have stateFields defined"
      );
    });
  });

  describe("Round-trip tests", () => {
    test("should preserve all data types through serialize/deserialize cycle", async () => {
      // Arrange
      const aggregate = new FakeOrderAggregate({
        id: "order-uuid-with-数字-and-émojis-🔒",
        correlationId: "correlation-uuid-456",
        version: 999,
        customerId: "customer-uuid-789",
        status: "completed",
        total: 12345.67,
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "order");
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("order-uuid-with-数字-and-émojis-🔒");
      expect(deserialized.version).toBe(999);
      expect(deserialized.total).toBe(12345.67);
      expect(deserialized.createdAt.getTime()).toBe(
        aggregate.createdAt.getTime()
      );
    });

    test("should handle multiple serialize/deserialize cycles", async () => {
      // Arrange
      const originalAggregate = new FakeUserAggregate({
        id: "user-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 1,
        email: "test@example.com",
        passwordHash: "super-secret-hash-12345",
        firstName: "John",
        lastName: "Doe",
      });

      // Act
      // First cycle
      const serialized1 = await serializer.serialize(originalAggregate, "user");
      const deserialized1 = await serializer.deserialize(serialized1);

      // Second cycle
      const serialized2 = await serializer.serialize(deserialized1, "user");
      const deserialized2 = await serializer.deserialize(serialized2);

      // Third cycle
      const serialized3 = await serializer.serialize(deserialized2, "user");
      const deserialized3 = await serializer.deserialize(serialized3);

      // Assert
      expect(deserialized3.id).toBe(originalAggregate.id);
      expect(deserialized3.email).toBe(originalAggregate.email);
      expect(deserialized3.passwordHash).toBe(originalAggregate.passwordHash);
      expect(deserialized3.firstName).toBe(originalAggregate.firstName);
      expect(deserialized3.lastName).toBe(originalAggregate.lastName);
    });

    test("should handle nested entities through multiple cycles", async () => {
      // Arrange
      const variant = new FakeVariantEntity({
        id: "variant-uuid-111",
        sku: "SKU-001",
        price: 49.99,
        inventory: 100,
      });

      const originalAggregate = new FakeProductAggregateWithVariant({
        id: "product-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 2,
        title: "Test Product",
        slug: "test-product",
        mainVariant: variant,
      });

      // Act
      const serialized1 = await serializer.serialize(
        originalAggregate,
        "productWithVariant"
      );
      const deserialized1 = await serializer.deserialize(serialized1);
      const serialized2 = await serializer.serialize(
        deserialized1,
        "productWithVariant"
      );
      const deserialized2 = await serializer.deserialize(serialized2);

      // Assert
      expect(deserialized2.mainVariant.id).toBe(variant.id);
      expect(deserialized2.mainVariant.sku).toBe(variant.sku);
      expect(deserialized2.mainVariant.price).toBe(variant.price);
      expect(deserialized2.mainVariant.inventory).toBe(variant.inventory);
    });
  });

  describe("Schema evolution and versioning", () => {
    test("should preserve version information in serialized data", async () => {
      // Arrange
      class VersionedAggregate {
        static readonly stateFields = [
          "id",
          "correlationId",
          "version",
          "name",
        ] as const;
        static readonly encryptedFields: string[] = [];
        static readonly stateVersion = 5; // Specific version

        id: string;
        correlationId: string;
        version: number;
        name: string;

        constructor({ id, correlationId, version, name }: any) {
          this.id = id;
          this.correlationId = correlationId;
          this.version = version;
          this.name = name;
        }
      }

      registerTestAggregate("versioned", VersionedAggregate);

      const aggregate = new VersionedAggregate({
        id: "test-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 1,
        name: "Test",
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "versioned");
      const decoded = decode(serialized) as any[];
      const [stateVersion, stateArray] = decoded[3];

      // Assert
      expect(stateVersion).toBe(5); // Should preserve the stateVersion
      expect(stateArray).toEqual([
        "test-uuid-123",
        "correlation-uuid-456",
        1,
        "Test",
      ]);
    });

    test("should handle missing fields gracefully", async () => {
      // Arrange
      const aggregate = new FakeOrderAggregate({
        id: "order-uuid-123",
        correlationId: "correlation-uuid-456",
        version: 5,
        customerId: "customer-uuid-789",
        status: "pending",
        // @ts-expect-error - total is missing to test undefined handling
        total: undefined,
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
      });

      // Act
      const serialized = await serializer.serialize(aggregate, "order");
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("order-uuid-123");
      expect(deserialized.total).toBeUndefined();
      expect(deserialized.status).toBe("pending");
    });
  });
});

describe("EntitySerializer", () => {
  const serializer = new EntitySerializer();

  describe("Entity without encrypted fields", () => {
    test("should serialize and deserialize entity correctly", async () => {
      // Arrange
      const entity = new FakeVariantEntity({
        id: "variant-uuid-111",
        sku: "SKU-001",
        price: 49.99,
        inventory: 100,
      });

      // Act
      const serialized = await serializer.serialize(entity);
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized).toBeInstanceOf(FakeVariantEntity);
      expect(deserialized.id).toBe("variant-uuid-111");
      expect(deserialized.sku).toBe("SKU-001");
      expect(deserialized.price).toBe(49.99);
      expect(deserialized.inventory).toBe(100);
    });

    test("should serialize entity in correct format", async () => {
      // Arrange
      const entity = new FakeVariantEntity({
        id: "variant-uuid-111",
        sku: "SKU-001",
        price: 49.99,
        inventory: 100,
      });

      // Act
      const serialized = await serializer.serialize(entity);

      // Assert
      // Format should be [entityType, stateVersion, stateArray]
      expect(Array.isArray(serialized)).toBe(true);
      expect(serialized[0]).toBe("variant");
      expect(serialized[1]).toBe(1);
      expect(serialized[2]).toEqual([
        "variant-uuid-111",
        "SKU-001",
        49.99,
        100,
      ]);
    });
  });

  describe("Entity with encrypted fields", () => {
    test("should serialize and deserialize entity with encrypted fields correctly", async () => {
      // Arrange
      const entity = new FakePaymentEntity({
        id: "payment-uuid-123",
        amount: 199.99,
        cardNumber: "4111-1111-1111-1111",
        currency: "USD",
      });

      // Act
      const serialized = await serializer.serialize(entity);
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized).toBeInstanceOf(FakePaymentEntity);
      expect(deserialized.id).toBe("payment-uuid-123");
      expect(deserialized.amount).toBe(199.99);
      expect(deserialized.cardNumber).toBe("4111-1111-1111-1111");
      expect(deserialized.currency).toBe("USD");
    });

    test("should encrypt specified fields in serialized entity", async () => {
      // Arrange
      const entity = new FakePaymentEntity({
        id: "payment-uuid-123",
        amount: 199.99,
        cardNumber: "4111-1111-1111-1111",
        currency: "USD",
      });

      // Act
      const serialized = await serializer.serialize(entity);
      const [entityType, version, stateArray] = serialized;

      // Assert
      // stateFields order: ["id", "amount", "cardNumber", "currency"]
      const [id, amount, cardNumber, currency] = stateArray;

      // The cardNumber field should be encrypted
      expect(cardNumber).not.toBe("4111-1111-1111-1111");
      expect(typeof cardNumber).toBe("string");
      expect(cardNumber.length).toBeGreaterThan(50);

      // Non-encrypted fields should remain in plaintext
      expect(id).toBe("payment-uuid-123");
      expect(amount).toBe(199.99);
      expect(currency).toBe("USD");
    });
  });

  describe("Error handling", () => {
    test("should throw error for entity without stateFields", async () => {
      // Arrange
      class InvalidEntity {
        id: string;
        constructor(id: string) {
          this.id = id;
        }
      }

      const entity = new InvalidEntity("test-123");

      // Act & Assert
      await expect(serializer.serialize(entity)).rejects.toThrow(
        "Entity InvalidEntity does not have stateFields defined"
      );
    });

    test("should throw error for unregistered entity during serialization", async () => {
      // Arrange
      class UnregisteredEntity {
        static readonly stateFields = ["id", "name"] as const;
        id: string;
        name: string;
        constructor(id: string, name: string) {
          this.id = id;
          this.name = name;
        }
      }

      const entity = new UnregisteredEntity("test-123", "Test");

      // Act & Assert
      await expect(serializer.serialize(entity)).rejects.toThrow(
        "Entity UnregisteredEntity is not registered in ENTITY_REGISTRY"
      );
    });

    test("should throw error for unknown entity type during deserialization", async () => {
      // Arrange
      const invalidData = ["unknownEntityType", 1, ["id-123", "value"]];

      // Act & Assert
      await expect(serializer.deserialize(invalidData as any)).rejects.toThrow(
        "Unknown entity type: unknownEntityType"
      );
    });
  });

  describe("Round-trip tests", () => {
    test("should preserve all data types through serialize/deserialize cycle", async () => {
      // Arrange
      const entity = new FakeVariantEntity({
        id: "variant-with-数字-and-émojis-🔒",
        sku: "SKU-special-chars-!@#$%",
        price: 99999.99,
        inventory: 0,
      });

      // Act
      const serialized = await serializer.serialize(entity);
      const deserialized = await serializer.deserialize(serialized);

      // Assert
      expect(deserialized.id).toBe("variant-with-数字-and-émojis-🔒");
      expect(deserialized.sku).toBe("SKU-special-chars-!@#$%");
      expect(deserialized.price).toBe(99999.99);
      expect(deserialized.inventory).toBe(0);
    });

    test("should handle multiple serialize/deserialize cycles", async () => {
      // Arrange
      const originalEntity = new FakePaymentEntity({
        id: "payment-uuid-123",
        amount: 199.99,
        cardNumber: "4111-1111-1111-1111",
        currency: "USD",
      });

      // Act
      const serialized1 = await serializer.serialize(originalEntity);
      const deserialized1 = await serializer.deserialize(serialized1);
      const serialized2 = await serializer.serialize(deserialized1);
      const deserialized2 = await serializer.deserialize(serialized2);
      const serialized3 = await serializer.serialize(deserialized2);
      const deserialized3 = await serializer.deserialize(serialized3);

      // Assert
      expect(deserialized3.id).toBe(originalEntity.id);
      expect(deserialized3.amount).toBe(originalEntity.amount);
      expect(deserialized3.cardNumber).toBe(originalEntity.cardNumber);
      expect(deserialized3.currency).toBe(originalEntity.currency);
    });
  });
});
