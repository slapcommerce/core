import { describe, test, expect } from "bun:test";
import { CollectionProductReadModel } from "../../../../../../src/api/app/collectionProduct/queries/admin/views";

describe("CollectionProductReadModel", () => {
  test("should create an instance", () => {
    // Act
    const model = new CollectionProductReadModel();

    // Assert
    expect(model).toBeInstanceOf(CollectionProductReadModel);
  });

  test("should allow setting all properties", () => {
    // Arrange
    const model = new CollectionProductReadModel();

    // Act
    model.collectionId = "collection-123";
    model.productId = "product-123";
    model.position = 0;
    model.name = "Test Product";
    model.slug = "test-product";
    model.vendor = "Test Vendor";
    model.description = "Test description";
    model.tags = "[]";
    model.status = "active";
    model.taxable = 1;
    model.taxId = "TAX123";
    model.productType = "digital";
    model.dropshipSafetyBuffer = null;
    model.variantOptions = "[]";
    model.metaTitle = "Meta Title";
    model.metaDescription = "Meta Description";
    model.richDescriptionUrl = "";
    model.variantIds = "[]";
    model.productCreatedAt = "2024-01-01T00:00:00.000Z";
    model.productUpdatedAt = "2024-01-01T00:00:00.000Z";
    model.publishedAt = "2024-01-01T00:00:00.000Z";
    model.correlationId = "correlation-123";
    model.productVersion = 1;

    // Assert
    expect(model.collectionId).toBe("collection-123");
    expect(model.productId).toBe("product-123");
    expect(model.position).toBe(0);
    expect(model.name).toBe("Test Product");
    expect(model.slug).toBe("test-product");
    expect(model.vendor).toBe("Test Vendor");
    expect(model.description).toBe("Test description");
    expect(model.tags).toBe("[]");
    expect(model.status).toBe("active");
    expect(model.taxable).toBe(1);
    expect(model.taxId).toBe("TAX123");
    expect(model.productType).toBe("digital");
    expect(model.dropshipSafetyBuffer).toBeNull();
    expect(model.variantOptions).toBe("[]");
    expect(model.metaTitle).toBe("Meta Title");
    expect(model.metaDescription).toBe("Meta Description");
    expect(model.richDescriptionUrl).toBe("");
    expect(model.variantIds).toBe("[]");
    expect(model.productCreatedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(model.productUpdatedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(model.publishedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(model.correlationId).toBe("correlation-123");
    expect(model.productVersion).toBe(1);
  });
});
