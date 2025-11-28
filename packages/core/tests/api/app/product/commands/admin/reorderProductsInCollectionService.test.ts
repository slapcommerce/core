import { describe, test, expect } from "bun:test";
import { ReorderProductsInCollectionService } from "../../../../../../src/api/app/product/commands/admin/reorderProductsInCollectionService";
import { ProductAggregate } from "../../../../../../src/api/domain/product/aggregate";
import { CollectionAggregate } from "../../../../../../src/api/domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../../../src/api/domain/productPositionsWithinCollection/aggregate";
import { createTestDatabase } from "../../../../../helpers/database";
import { TransactionBatcher } from "../../../../../../src/api/infrastructure/transactionBatcher";
import { UnitOfWork } from "../../../../../../src/api/infrastructure/unitOfWork";
import { randomUUIDv7 } from "bun";

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
  collections: string[];
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
  test("should reorder products in existing positions aggregate", async () => {
    // Arrange
    const { db, unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const collectionId = randomUUIDv7();
    const positionsAggregateId = randomUUIDv7();
    const productId1 = randomUUIDv7();
    const productId2 = randomUUIDv7();

    // Create collection with positions aggregate reference
    const collection = CollectionAggregate.create({
      id: collectionId,
      correlationId: randomUUIDv7(),
      userId: "user-123",
      name: "Test Collection",
      description: "Test",
      slug: `test-collection-${collectionId}`,
      productPositionsAggregateId: positionsAggregateId,
    });

    // Create positions aggregate with initial order
    const positionsAggregate = ProductPositionsWithinCollectionAggregate.create({
      id: positionsAggregateId,
      collectionId,
      correlationId: randomUUIDv7(),
      userId: "user-123",
      productIds: [productId1, productId2],
    });

    // Save collection and positions aggregate
    await unitOfWork.withTransaction(async (repositories) => {
      for (const event of collection.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: collection.id,
        correlationId: "correlation-123",
        version: collection.version,
        payload: collection.toSnapshot(),
      });

      for (const event of positionsAggregate.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: positionsAggregateId,
        correlationId: "correlation-123",
        version: positionsAggregate.version,
        payload: positionsAggregate.toSnapshot(),
      });
    });

    // Act - swap the order (product2 first, then product1)
    await service.execute({
      type: "reorderProductsInCollection",
      collectionId,
      productPositions: [
        { productId: productId2, position: 0 },
        { productId: productId1, position: 1 },
      ],
      userId: "user-123",
    });

    // Assert - check that positions aggregate was updated
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get(positionsAggregateId) as { payload: string } | null;

    expect(snapshot).not.toBeNull();
    const payload = JSON.parse(snapshot!.payload);
    expect(payload.productIds).toEqual([productId2, productId1]);
    expect(payload.version).toBe(1);
  });

  test("should emit reorder event", async () => {
    // Arrange
    const { db, unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const collectionId = randomUUIDv7();
    const positionsAggregateId = randomUUIDv7();
    const productId1 = randomUUIDv7();
    const productId2 = randomUUIDv7();

    // Create collection with positions aggregate reference
    const collection = CollectionAggregate.create({
      id: collectionId,
      correlationId: randomUUIDv7(),
      userId: "user-123",
      name: "Test Collection",
      description: "Test",
      slug: `test-collection-${collectionId}`,
      productPositionsAggregateId: positionsAggregateId,
    });

    // Create positions aggregate
    const positionsAggregate = ProductPositionsWithinCollectionAggregate.create({
      id: positionsAggregateId,
      collectionId,
      correlationId: randomUUIDv7(),
      userId: "user-123",
      productIds: [productId1, productId2],
    });

    // Save collection and positions aggregate
    await unitOfWork.withTransaction(async (repositories) => {
      for (const event of collection.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: collection.id,
        correlationId: "correlation-123",
        version: collection.version,
        payload: collection.toSnapshot(),
      });

      for (const event of positionsAggregate.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: positionsAggregateId,
        correlationId: "correlation-123",
        version: positionsAggregate.version,
        payload: positionsAggregate.toSnapshot(),
      });
    });

    // Act
    await service.execute({
      type: "reorderProductsInCollection",
      collectionId,
      productPositions: [
        { productId: productId2, position: 0 },
        { productId: productId1, position: 1 },
      ],
      userId: "user-123",
    });

    // Assert - check events
    const events = db
      .query("SELECT * FROM events WHERE aggregateId = ? ORDER BY version")
      .all(positionsAggregateId) as Array<{ eventType: string }>;

    // Note: First event was saved when setting up the test (created), second is the reorder
    expect(events).toHaveLength(2);
    expect(events[0]!.eventType).toBe("productPositionsWithinCollection.created");
    expect(events[1]!.eventType).toBe("productPositionsWithinCollection.reordered");
  });

  test("should throw error when reordering with invalid products", async () => {
    // Arrange
    const { unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const collectionId = randomUUIDv7();
    const positionsAggregateId = randomUUIDv7();
    const productId1 = randomUUIDv7();
    const productId2 = randomUUIDv7();
    const productId3 = randomUUIDv7();

    // Create collection with positions aggregate reference
    const collection = CollectionAggregate.create({
      id: collectionId,
      correlationId: randomUUIDv7(),
      userId: "user-123",
      name: "Test Collection",
      description: "Test",
      slug: `test-collection-${collectionId}`,
      productPositionsAggregateId: positionsAggregateId,
    });

    // Create positions aggregate with only 2 products
    const positionsAggregate = ProductPositionsWithinCollectionAggregate.create({
      id: positionsAggregateId,
      collectionId,
      correlationId: randomUUIDv7(),
      userId: "user-123",
      productIds: [productId1, productId2],
    });

    // Save collection and positions aggregate
    await unitOfWork.withTransaction(async (repositories) => {
      for (const event of collection.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: collection.id,
        correlationId: "correlation-123",
        version: collection.version,
        payload: collection.toSnapshot(),
      });

      for (const event of positionsAggregate.uncommittedEvents) {
        repositories.eventRepository.addEvent(event);
      }
      repositories.snapshotRepository.saveSnapshot({
        aggregateId: positionsAggregateId,
        correlationId: "correlation-123",
        version: positionsAggregate.version,
        payload: positionsAggregate.toSnapshot(),
      });
    });

    // Act & Assert - try to reorder with a product that's not in the collection
    await expect(
      service.execute({
        type: "reorderProductsInCollection",
        collectionId,
        productPositions: [
          { productId: productId3, position: 0 },
          { productId: productId1, position: 1 },
        ],
        userId: "user-123",
      }),
    ).rejects.toThrow("is not in this collection");
  });

  test("should throw error when collection not found", async () => {
    // Arrange
    const { unitOfWork } = await setupTestEnvironment();
    const service = new ReorderProductsInCollectionService(unitOfWork);
    const collectionId = randomUUIDv7();

    // Act & Assert - try to reorder in non-existent collection
    await expect(
      service.execute({
        type: "reorderProductsInCollection",
        collectionId,
        productPositions: [
          { productId: randomUUIDv7(), position: 0 },
        ],
        userId: "user-123",
      }),
    ).rejects.toThrow(`Collection with id ${collectionId} not found`);
  });
});
