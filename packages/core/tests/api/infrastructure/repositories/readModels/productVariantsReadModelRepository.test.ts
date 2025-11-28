import { describe, test, expect } from "bun:test";
import { ProductVariantsReadModelRepository } from "../../../../../src/api/infrastructure/repositories/readModels/productVariantsReadModelRepository";
import { TransactionBatch } from "../../../../../src/api/infrastructure/transactionBatch";
import { ImageCollection } from "../../../../../src/api/domain/_base/imageCollection";
import {
  createTestDatabase,
  closeTestDatabase,
} from "../../../../helpers/database";

describe("ProductVariantsReadModelRepository", () => {
  test("should add save command to batch with correct parameters", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      repository.save({
        productId: "product-123",
        variantId: "variant-123",
        position: 0,
        sku: "SKU-001",
        price: 29.99,
        inventory: 100,
        options: { size: "M", color: "Blue" },
        variantStatus: "draft",
        images: ImageCollection.empty(),
        digitalAsset: null,
        variantCreatedAt: new Date("2024-01-01T00:00:00.000Z"),
        variantUpdatedAt: new Date("2024-01-01T00:00:00.000Z"),
        variantPublishedAt: null,
        productName: "Test Product",
        productSlug: "test-product",
        productDescription: "Test description",
        productStatus: "draft",
        productVendor: "Test Vendor",
        fulfillmentType: "digital",
        dropshipSafetyBuffer: undefined,
        defaultVariantId: null,
        variantOptions: [{ name: "Size", values: ["S", "M", "L"] }],
        collections: ["collection-123"],
        tags: ["tag1", "tag2"],
        taxable: true,
        taxId: "tax-123",
        metaTitle: "Test Meta Title",
        metaDescription: "Test Meta Description",
        richDescriptionUrl: "",
        productCreatedAt: new Date("2024-01-01T00:00:00.000Z"),
        productUpdatedAt: new Date("2024-01-01T00:00:00.000Z"),
        productPublishedAt: null,
        variantCorrelationId: "correlation-123",
        variantVersion: 0,
      });

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("insert");
      expect(batch.commands[0]!.params[0]).toBe("product-123");
      expect(batch.commands[0]!.params[1]).toBe("variant-123");
      expect(batch.commands[0]!.params[3]).toBe("SKU-001");
      expect(batch.commands[0]!.params[4]).toBe(29.99);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add delete command to batch", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      repository.delete("product-123", "variant-123");

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("delete");
      expect(batch.commands[0]!.params).toEqual(["product-123", "variant-123"]);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add updatePositions command to batch", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      repository.updatePositions("product-123", [
        { variantId: "variant-3", position: 0 },
        { variantId: "variant-1", position: 1 },
        { variantId: "variant-2", position: 2 },
      ]);

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("update");
      expect(batch.commands[0]!.params).toEqual(["product-123"]);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should not add command when positions array is empty", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      repository.updatePositions("product-123", []);

      // Assert - no commands should be added to the batch
      expect(batch.commands).toHaveLength(0);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add updateProductFields command to batch", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      repository.updateProductFields("product-123", {
        productName: "New Name",
        productSlug: "new-slug",
        productDescription: "New description",
        productStatus: "active",
        productVendor: "New Vendor",
        fulfillmentType: "dropship",
        dropshipSafetyBuffer: 5,
        defaultVariantId: "variant-1",
        variantOptions: [{ name: "Color", values: ["Red", "Blue"] }],
        collections: ["collection-new"],
        tags: ["new-tag"],
        taxable: false,
        taxId: "new-tax",
        metaTitle: "New Title",
        metaDescription: "New Meta",
        richDescriptionUrl: "http://example.com",
        productCreatedAt: new Date("2024-01-01T00:00:00.000Z"),
        productUpdatedAt: new Date("2024-01-02T00:00:00.000Z"),
        productPublishedAt: new Date("2024-01-02T00:00:00.000Z"),
      });

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("update");
      // Last param should be the productId
      expect(batch.commands[0]!.params[19]).toBe("product-123");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should get product fields from productReadModel", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      // Insert a product into productReadModel
      db.run(`
        INSERT INTO productReadModel (
          aggregateId, name, slug, vendor, description, tags, createdAt, status,
          correlationId, taxable, taxId, fulfillmentType, dropshipSafetyBuffer,
          variantOptions, version, updatedAt, publishedAt, collections, metaTitle,
          metaDescription, richDescriptionUrl, defaultVariantId
        ) VALUES (
          'product-123', 'Test Product', 'test-product', 'Test Vendor', 'Test description',
          '["tag1"]', '2024-01-01T00:00:00.000Z', 'active', 'corr-123', 1, 'tax-123',
          'digital', NULL, '[{"name":"Size","values":["S","M"]}]', 1,
          '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', '["coll-1"]',
          'Meta Title', 'Meta Desc', 'http://rich.url', 'variant-default'
        )
      `);

      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      const productFields = repository.getProductFields("product-123");

      // Assert
      expect(productFields).not.toBeNull();
      expect(productFields?.productName).toBe("Test Product");
      expect(productFields?.productSlug).toBe("test-product");
      expect(productFields?.productVendor).toBe("Test Vendor");
      expect(productFields?.productStatus).toBe("active");
      expect(productFields?.fulfillmentType).toBe("digital");
      expect(productFields?.defaultVariantId).toBe("variant-default");
      expect(productFields?.taxId).toBe("tax-123");
      expect(productFields?.taxable).toBe(true);
      expect(productFields?.richDescriptionUrl).toBe("http://rich.url");
      expect(productFields?.variantOptions).toEqual([
        { name: "Size", values: ["S", "M"] },
      ]);
      expect(productFields?.collections).toEqual(["coll-1"]);
      expect(productFields?.tags).toEqual(["tag1"]);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should return null when product not found", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      // Act
      const productFields = repository.getProductFields("non-existent-product");

      // Assert
      expect(productFields).toBeNull();
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should saveFromVariantState add correct command to batch", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new ProductVariantsReadModelRepository(db, batch);

      const variantState = {
        productId: "product-123",
        sku: "SKU-FROM-STATE",
        price: 19.99,
        inventory: 50,
        options: { size: "L" },
        status: "active" as const,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
        publishedAt: new Date("2024-01-02T00:00:00.000Z"),
        images: ImageCollection.empty(),
        digitalAsset: {
          name: "file.pdf",
          fileKey: "key",
          mimeType: "application/pdf",
          size: 1024,
        },
        correlationId: "corr-variant",
        version: 2,
      };

      const productFields = {
        productName: "Product From State",
        productSlug: "product-from-state",
        productDescription: "Desc",
        productStatus: "active" as const,
        productVendor: "Vendor",
        fulfillmentType: "digital" as const,
        dropshipSafetyBuffer: undefined,
        defaultVariantId: "variant-xyz",
        variantOptions: [],
        collections: [],
        tags: [],
        taxable: true,
        taxId: "tax",
        metaTitle: "",
        metaDescription: "",
        richDescriptionUrl: "",
        productCreatedAt: new Date("2024-01-01T00:00:00.000Z"),
        productUpdatedAt: new Date("2024-01-01T00:00:00.000Z"),
        productPublishedAt: null,
      };

      // Act
      repository.saveFromVariantState(
        "variant-from-state",
        variantState,
        productFields
      );

      // Assert
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("insert");
      expect(batch.commands[0]!.params[0]).toBe("product-123");
      expect(batch.commands[0]!.params[1]).toBe("variant-from-state");
      expect(batch.commands[0]!.params[2]).toBe(0); // Default position
      expect(batch.commands[0]!.params[3]).toBe("SKU-FROM-STATE");
    } finally {
      closeTestDatabase(db);
    }
  });
});
