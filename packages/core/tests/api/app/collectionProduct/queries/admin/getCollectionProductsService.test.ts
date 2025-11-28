import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { GetCollectionProductsService } from "../../../../../../src/api/app/collectionProduct/queries/admin/getCollectionProductsService";
import { schemas } from "../../../../../../src/api/infrastructure/schemas";

function createTestDatabase(): Database {
  const db = new Database(":memory:");
  for (const schema of schemas) {
    db.run(schema);
  }
  return db;
}

function insertCollectionProduct(
  db: Database,
  data: {
    collectionId: string;
    productId: string;
    position: number;
    name: string;
    status?: "draft" | "active" | "archived";
  },
) {
  db.run(
    `INSERT INTO collectionProductsReadModel (
      collectionId, productId, position, name, slug, vendor, description,
      tags, status, taxable, taxId, fulfillmentType, variantOptions,
      metaTitle, metaDescription, richDescriptionUrl, variantIds,
      productCreatedAt, productUpdatedAt, correlationId, productVersion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.collectionId,
      data.productId,
      data.position,
      data.name,
      "test-slug",
      "Test Vendor",
      "Test description",
      "[]",
      data.status ?? "draft",
      1,
      "TAX123",
      "digital",
      "[]",
      "",
      "",
      "",
      "[]",
      new Date().toISOString(),
      new Date().toISOString(),
      "correlation-123",
      1,
    ],
  );
}

describe("GetCollectionProductsService", () => {
  test("should return products for a collection ordered by position", () => {
    // Arrange
    const db = createTestDatabase();
    const service = new GetCollectionProductsService(db);
    const collectionId = "collection-123";

    insertCollectionProduct(db, {
      collectionId,
      productId: "product-2",
      position: 1,
      name: "Product B",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-1",
      position: 0,
      name: "Product A",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-3",
      position: 2,
      name: "Product C",
    });

    // Act
    const result = service.handle({ collectionId });

    // Assert
    expect(result).toHaveLength(3);
    expect(result[0]!.productId).toBe("product-1");
    expect(result[0]!.position).toBe(0);
    expect(result[1]!.productId).toBe("product-2");
    expect(result[1]!.position).toBe(1);
    expect(result[2]!.productId).toBe("product-3");
    expect(result[2]!.position).toBe(2);
  });

  test("should filter by status", () => {
    // Arrange
    const db = createTestDatabase();
    const service = new GetCollectionProductsService(db);
    const collectionId = "collection-123";

    insertCollectionProduct(db, {
      collectionId,
      productId: "product-1",
      position: 0,
      name: "Active Product",
      status: "active",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-2",
      position: 1,
      name: "Draft Product",
      status: "draft",
    });

    // Act
    const result = service.handle({ collectionId, status: "active" });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.productId).toBe("product-1");
  });

  test("should respect limit parameter", () => {
    // Arrange
    const db = createTestDatabase();
    const service = new GetCollectionProductsService(db);
    const collectionId = "collection-123";

    insertCollectionProduct(db, {
      collectionId,
      productId: "product-1",
      position: 0,
      name: "Product A",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-2",
      position: 1,
      name: "Product B",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-3",
      position: 2,
      name: "Product C",
    });

    // Act
    const result = service.handle({ collectionId, limit: 2 });

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]!.productId).toBe("product-1");
    expect(result[1]!.productId).toBe("product-2");
  });

  test("should respect offset parameter", () => {
    // Arrange
    const db = createTestDatabase();
    const service = new GetCollectionProductsService(db);
    const collectionId = "collection-123";

    insertCollectionProduct(db, {
      collectionId,
      productId: "product-1",
      position: 0,
      name: "Product A",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-2",
      position: 1,
      name: "Product B",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-3",
      position: 2,
      name: "Product C",
    });

    // Act
    const result = service.handle({ collectionId, offset: 1 });

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]!.productId).toBe("product-2");
    expect(result[1]!.productId).toBe("product-3");
  });

  test("should respect both limit and offset parameters", () => {
    // Arrange
    const db = createTestDatabase();
    const service = new GetCollectionProductsService(db);
    const collectionId = "collection-123";

    insertCollectionProduct(db, {
      collectionId,
      productId: "product-1",
      position: 0,
      name: "Product A",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-2",
      position: 1,
      name: "Product B",
    });
    insertCollectionProduct(db, {
      collectionId,
      productId: "product-3",
      position: 2,
      name: "Product C",
    });

    // Act
    const result = service.handle({ collectionId, limit: 1, offset: 1 });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.productId).toBe("product-2");
  });

  test("should return empty array for collection with no products", () => {
    // Arrange
    const db = createTestDatabase();
    const service = new GetCollectionProductsService(db);

    // Act
    const result = service.handle({ collectionId: "nonexistent-collection" });

    // Assert
    expect(result).toHaveLength(0);
  });
});
