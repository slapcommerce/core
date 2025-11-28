import { describe, test, expect } from "bun:test";
import { ProductPositionsWithinCollectionAggregate } from "../../../../src/api/domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";

describe("ProductPositionsWithinCollectionAggregate", () => {
  function createValidParams() {
    return {
      id: randomUUIDv7(),
      collectionId: randomUUIDv7(),
      correlationId: randomUUIDv7(),
      userId: "user-123",
      productIds: [randomUUIDv7(), randomUUIDv7()],
    };
  }

  describe("create", () => {
    test("should create a positions aggregate with products", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(aggregate.id).toBe(params.id);
      expect(aggregate.collectionId).toBe(params.collectionId);
      expect(aggregate.getProductIds()).toEqual(params.productIds);
      expect(aggregate.version).toBe(0);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "productPositionsWithinCollection.created",
      );
    });

    test("should create a positions aggregate with empty products", () => {
      const params = createValidParams();
      params.productIds = [];
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(aggregate.getProductIds()).toEqual([]);
    });

    test("should create a positions aggregate without productIds param", () => {
      const aggregate = ProductPositionsWithinCollectionAggregate.create({
        id: randomUUIDv7(),
        collectionId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
      });

      expect(aggregate.getProductIds()).toEqual([]);
    });
  });

  describe("getProductPosition", () => {
    test("should return correct position for product", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(aggregate.getProductPosition(params.productIds[0]!)).toBe(0);
      expect(aggregate.getProductPosition(params.productIds[1]!)).toBe(1);
    });

    test("should return -1 for product not in collection", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(aggregate.getProductPosition("nonexistent")).toBe(-1);
    });
  });

  describe("reorder", () => {
    test("should reorder products", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);
      aggregate.uncommittedEvents = [];

      const newOrder = [params.productIds[1]!, params.productIds[0]!];
      aggregate.reorder(newOrder, "user-123");

      expect(aggregate.getProductIds()).toEqual(newOrder);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "productPositionsWithinCollection.reordered",
      );
    });

    test("should throw error when new order has different number of products", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(() => aggregate.reorder([params.productIds[0]!], "user-123")).toThrow(
        "New order must contain the same number of products",
      );
    });

    test("should throw error when new order contains product not in collection", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(() =>
        aggregate.reorder([params.productIds[0]!, "nonexistent"], "user-123"),
      ).toThrow("is not in this collection");
    });
  });

  describe("addProduct", () => {
    test("should add product to end by default", () => {
      const productId1 = randomUUIDv7();
      const productId2 = randomUUIDv7();
      const aggregate = ProductPositionsWithinCollectionAggregate.create({
        id: randomUUIDv7(),
        collectionId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        productIds: [productId1, productId2],
      });
      aggregate.uncommittedEvents = [];

      const newProductId = randomUUIDv7();
      aggregate.addProduct(newProductId, "user-123");

      expect(aggregate.getProductIds()).toEqual([productId1, productId2, newProductId]);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "productPositionsWithinCollection.product_added",
      );
    });

    test("should add product at specific position", () => {
      const productId1 = randomUUIDv7();
      const productId2 = randomUUIDv7();
      const aggregate = ProductPositionsWithinCollectionAggregate.create({
        id: randomUUIDv7(),
        collectionId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        productIds: [productId1, productId2],
      });
      aggregate.uncommittedEvents = [];

      const newProductId = randomUUIDv7();
      aggregate.addProduct(newProductId, "user-123", 1);

      expect(aggregate.getProductIds()).toEqual([productId1, newProductId, productId2]);
    });

    test("should add product at position 0", () => {
      const productId1 = randomUUIDv7();
      const productId2 = randomUUIDv7();
      const aggregate = ProductPositionsWithinCollectionAggregate.create({
        id: randomUUIDv7(),
        collectionId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        productIds: [productId1, productId2],
      });
      aggregate.uncommittedEvents = [];

      const newProductId = randomUUIDv7();
      aggregate.addProduct(newProductId, "user-123", 0);

      expect(aggregate.getProductIds()).toEqual([newProductId, productId1, productId2]);
    });

    test("should add product to end if position is beyond length", () => {
      const productId1 = randomUUIDv7();
      const productId2 = randomUUIDv7();
      const aggregate = ProductPositionsWithinCollectionAggregate.create({
        id: randomUUIDv7(),
        collectionId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        productIds: [productId1, productId2],
      });
      aggregate.uncommittedEvents = [];

      const newProductId = randomUUIDv7();
      aggregate.addProduct(newProductId, "user-123", 100);

      expect(aggregate.getProductIds()).toEqual([productId1, productId2, newProductId]);
    });

    test("should throw error when adding duplicate product", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(() =>
        aggregate.addProduct(params.productIds[0]!, "user-123"),
      ).toThrow("is already in this collection");
    });
  });

  describe("removeProduct", () => {
    test("should remove product from collection", () => {
      const productId1 = randomUUIDv7();
      const productId2 = randomUUIDv7();
      const aggregate = ProductPositionsWithinCollectionAggregate.create({
        id: randomUUIDv7(),
        collectionId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        productIds: [productId1, productId2],
      });
      aggregate.uncommittedEvents = [];

      aggregate.removeProduct(productId1, "user-123");

      expect(aggregate.getProductIds()).toEqual([productId2]);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "productPositionsWithinCollection.product_removed",
      );
    });

    test("should throw error when removing product not in collection", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);

      expect(() => aggregate.removeProduct("nonexistent", "user-123")).toThrow(
        "is not in this collection",
      );
    });
  });

  describe("loadFromSnapshot", () => {
    test("should load aggregate from snapshot", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);
      const snapshot = aggregate.toSnapshot();

      const loaded = ProductPositionsWithinCollectionAggregate.loadFromSnapshot({
        aggregateId: params.id,
        correlationId: params.correlationId,
        version: 0,
        payload: JSON.stringify(snapshot),
      });

      expect(loaded.id).toBe(params.id);
      expect(loaded.collectionId).toBe(params.collectionId);
      expect(loaded.getProductIds()).toEqual(params.productIds);
      expect(loaded.version).toBe(0);
      expect(loaded.uncommittedEvents).toHaveLength(0);
    });
  });

  describe("toSnapshot", () => {
    test("should return snapshot data", () => {
      const params = createValidParams();
      const aggregate = ProductPositionsWithinCollectionAggregate.create(params);
      const snapshot = aggregate.toSnapshot();

      expect(snapshot.collectionId).toBe(params.collectionId);
      expect(snapshot.productIds).toEqual(params.productIds);
      expect(snapshot.version).toBe(0);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.updatedAt).toBeInstanceOf(Date);
    });
  });
});
