import { describe, test, expect } from "bun:test";
import { ReorderProductsInCollectionService } from "../../../../../../src/api/app/product/commands/admin/reorderProductsInCollectionService";
import { ProductAggregate } from "../../../../../../src/api/domain/product/aggregate";
import { createTestDatabase } from "../../../../../helpers/database";
import { TransactionBatcher } from "../../../../../../src/api/infrastructure/transactionBatcher";
import { UnitOfWork } from "../../../../../../src/api/infrastructure/unitOfWork";

async function setupTestEnvironment() {
  const db = createTestDatabase();
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100,
  });
  batcher.start();
  const unitOfWork = new UnitOfWork(db, batcher);
  return { db, batcher, unitOfWork };
}

function createProductParams(overrides: {
  id: string;
  collections: Array<{ collectionId: string; position: number }>;
}) {
  return {
    id: overrides.id,
    correlationId: "correlation-123",
    userId: "user-123",
    name: "Test Product",
    description: "A test product",
    slug: `test-product-${overrides.id}`,
    collections: overrides.collections,
    variantIds: [],
    richDescriptionUrl: "",
    fulfillmentType: "digital" as const,
    vendor: "Test Vendor",
    variantOptions: [],
    metaTitle: "",
    metaDescription: "",
    tags: [],
    taxable: true,
    taxId: "TAX123",
    dropshipSafetyBuffer: 0,
  };
}

describe("ReorderProductsInCollectionService", () => {
  test("should update position for a product in a collection", async () => {
    // Arrange
    const { db, unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const collectionId = "collection-123";
    const productId = "product-123";

    // Create a product in the collection
    const product = ProductAggregate.create(
      createProductParams({
        id: productId,
        collections: [{ collectionId, position: 0 }],
      }),
    );

    // Save the product
    await unitOfWork.withTransaction(async (repositories) => {
      for (const event of product.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: product.id,
        correlationId: "correlation-123",
        version: product.version,
        payload: product.toSnapshot(),
      });
    });

    // Act
    await service.execute({
      type: "reorderProductsInCollection",
      collectionId,
      productPositions: [{ productId, position: 5 }],
      userId: "user-123",
    });

    // Assert
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get(productId) as { payload: string };
    const payload = JSON.parse(snapshot.payload);
    const collection = payload.collections.find(
      (c: { collectionId: string }) => c.collectionId === collectionId,
    );
    expect(collection.position).toBe(5);
  });

  test("should update positions for multiple products in a collection", async () => {
    // Arrange
    const { db, unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const collectionId = "collection-123";

    // Create two products in the collection
    const product1 = ProductAggregate.create(
      createProductParams({
        id: "product-1",
        collections: [{ collectionId, position: 0 }],
      }),
    );
    const product2 = ProductAggregate.create(
      createProductParams({
        id: "product-2",
        collections: [{ collectionId, position: 1 }],
      }),
    );

    // Save the products
    await unitOfWork.withTransaction(async (repositories) => {
      for (const event of product1.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: product1.id,
        correlationId: "correlation-123",
        version: product1.version,
        payload: product1.toSnapshot(),
      });
      for (const event of product2.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: product2.id,
        correlationId: "correlation-123",
        version: product2.version,
        payload: product2.toSnapshot(),
      });
    });

    // Act - swap positions
    await service.execute({
      type: "reorderProductsInCollection",
      collectionId,
      productPositions: [
        { productId: "product-1", position: 1 },
        { productId: "product-2", position: 0 },
      ],
      userId: "user-123",
    });

    // Assert
    const snapshot1 = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get("product-1") as { payload: string };
    const payload1 = JSON.parse(snapshot1.payload);
    expect(payload1.collections[0].position).toBe(1);

    const snapshot2 = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get("product-2") as { payload: string };
    const payload2 = JSON.parse(snapshot2.payload);
    expect(payload2.collections[0].position).toBe(0);
  });

  test("should throw error if product is not found", async () => {
    // Arrange
    const { unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);

    // Act & Assert
    await expect(
      service.execute({
        type: "reorderProductsInCollection",
        collectionId: "collection-123",
        productPositions: [{ productId: "nonexistent", position: 0 }],
        userId: "user-123",
      }),
    ).rejects.toThrow("Product with id nonexistent not found");
  });

  test("should throw error if product is not in the specified collection", async () => {
    // Arrange
    const { unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const productId = "product-123";

    // Create a product in a different collection
    const product = ProductAggregate.create(
      createProductParams({
        id: productId,
        collections: [{ collectionId: "other-collection", position: 0 }],
      }),
    );

    // Save the product
    await unitOfWork.withTransaction(async (repositories) => {
      for (const event of product.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: product.id,
        correlationId: "correlation-123",
        version: product.version,
        payload: product.toSnapshot(),
      });
    });

    // Act & Assert
    await expect(
      service.execute({
        type: "reorderProductsInCollection",
        collectionId: "collection-123",
        productPositions: [{ productId, position: 0 }],
        userId: "user-123",
      }),
    ).rejects.toThrow("Product is not in this collection");
  });
});
