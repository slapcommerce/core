import { describe, test, expect } from "bun:test";
import { CollectionProductsReadModelRepository } from "../../../../../src/api/infrastructure/repositories/readModels/collectionProductsReadModelRepository";
import { TransactionBatch } from "../../../../../src/api/infrastructure/transactionBatch";
import {
  createTestDatabase,
  closeTestDatabase,
} from "../../../../helpers/database";

describe("CollectionProductsReadModelRepository", () => {
  test("should add save command to batch with correct parameters", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.save({
        collectionId: "collection-123",
        productId: "product-123",
        position: 0,
        name: "Test Product",
        slug: "test-product",
        vendor: "Test Vendor",
        description: "Test description",
        tags: ["tag1", "tag2"],
        status: "draft",
        taxable: true,
        taxId: "tax-123",
        productType: "digital",
        dropshipSafetyBuffer: undefined,
        variantOptions: [{ name: "Size", values: ["S", "M", "L"] }],
        metaTitle: "Test Meta Title",
        metaDescription: "Test Meta Description",
        richDescriptionUrl: "",
        variantIds: [],
        productCreatedAt: new Date("2024-01-01T00:00:00.000Z"),
        productUpdatedAt: new Date("2024-01-01T00:00:00.000Z"),
        publishedAt: null,
        correlationId: "correlation-123",
        productVersion: 0,
      });

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("insert");
      expect(batch.commands[0]!.params[0]).toBe("collection-123");
      expect(batch.commands[0]!.params[1]).toBe("product-123");
      expect(batch.commands[0]!.params[2]).toBe(0); // position
      expect(batch.commands[0]!.params[3]).toBe("Test Product"); // name
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add updatePositions command to batch", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.updatePositions("collection-123", [
        { productId: "product-3", position: 0 },
        { productId: "product-1", position: 1 },
        { productId: "product-2", position: 2 },
      ]);

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("update");
      expect(batch.commands[0]!.params).toEqual(["collection-123"]);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should not add command when positions array is empty", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.updatePositions("collection-123", []);

      // Assert - no commands should be added to the batch
      expect(batch.commands).toHaveLength(0);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add delete command to batch", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.delete("collection-123", "product-123");

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("delete");
      expect(batch.commands[0]!.params).toEqual(["collection-123", "product-123"]);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should saveFromProductState add correct commands to batch for dropship product", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.saveFromProductState("product-123", {
        productType: "dropship",
        name: "Dropship Product",
        description: "Dropship description",
        slug: "dropship-product",
        collections: ["collection-1", "collection-2"],
        variantPositionsAggregateId: "variant-positions-123",
        defaultVariantId: null,
        richDescriptionUrl: "",
        vendor: "Test Vendor",
        variantOptions: [],
        metaTitle: "Test Meta Title",
        metaDescription: "Test Meta Description",
        tags: ["tag1", "tag2"],
        taxable: true,
        taxId: "",
        dropshipSafetyBuffer: 5,
        fulfillmentProviderId: "provider-123",
        supplierCost: 50.0,
        supplierSku: "SUPPLIER-SKU-001",
        status: "draft",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        publishedAt: null,
        correlationId: "correlation-123",
        version: 0,
      });

      // Assert - should add one command per collection
      expect(batch.commands.length).toBe(2);
      expect(batch.commands[0]!.type).toBe("insert");
      expect(batch.commands[0]!.params[0]).toBe("collection-1");
      expect(batch.commands[0]!.params[1]).toBe("product-123");
      expect(batch.commands[1]!.params[0]).toBe("collection-2");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should saveFromProductState add correct commands to batch for digital downloadable product", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.saveFromProductState("product-456", {
        productType: "digital_downloadable",
        name: "Digital Product",
        description: "Digital description",
        slug: "digital-product",
        collections: ["collection-digital"],
        variantPositionsAggregateId: "variant-positions-456",
        defaultVariantId: "variant-default",
        richDescriptionUrl: "https://example.com/rich",
        vendor: "Digital Vendor",
        variantOptions: [{ name: "Format", values: ["PDF", "EPUB"] }],
        metaTitle: "Digital Meta Title",
        metaDescription: "Digital Meta Description",
        tags: ["digital", "ebook"],
        taxable: false,
        taxId: "tax-digital",
        maxDownloads: 5,
        accessDurationDays: 30,
        status: "active",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
        publishedAt: new Date("2024-01-02T00:00:00.000Z"),
        correlationId: "correlation-456",
        version: 1,
      });

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("insert");
      expect(batch.commands[0]!.params[0]).toBe("collection-digital");
      expect(batch.commands[0]!.params[1]).toBe("product-456");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should not add commands when product has no collections", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new CollectionProductsReadModelRepository(db, batch);

      // Act
      repository.saveFromProductState("product-no-collections", {
        productType: "dropship",
        name: "No Collections Product",
        description: "No collections",
        slug: "no-collections",
        collections: [],
        variantPositionsAggregateId: "variant-positions-nc",
        defaultVariantId: null,
        richDescriptionUrl: "",
        vendor: "Vendor",
        variantOptions: [],
        metaTitle: "",
        metaDescription: "",
        tags: [],
        taxable: true,
        taxId: "",
        dropshipSafetyBuffer: 0,
        fulfillmentProviderId: null,
        supplierCost: null,
        supplierSku: null,
        status: "draft",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        publishedAt: null,
        correlationId: "correlation-nc",
        version: 0,
      });

      // Assert - no commands should be added
      expect(batch.commands).toHaveLength(0);
    } finally {
      closeTestDatabase(db);
    }
  });
});
