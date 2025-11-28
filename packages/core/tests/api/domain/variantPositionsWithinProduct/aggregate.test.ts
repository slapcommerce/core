import { describe, test, expect } from "bun:test";
import { VariantPositionsWithinProductAggregate } from "../../../../src/api/domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";

describe("VariantPositionsWithinProductAggregate", () => {
  function createValidParams() {
    return {
      id: randomUUIDv7(),
      productId: randomUUIDv7(),
      correlationId: randomUUIDv7(),
      userId: "user-123",
      variantIds: [randomUUIDv7(), randomUUIDv7()],
    };
  }

  describe("create", () => {
    test("should create a positions aggregate with variants", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(aggregate.id).toBe(params.id);
      expect(aggregate.productId).toBe(params.productId);
      expect(aggregate.getVariantIds()).toEqual(params.variantIds);
      expect(aggregate.version).toBe(0);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "variantPositionsWithinProduct.created",
      );
    });

    test("should create a positions aggregate with empty variants", () => {
      const params = createValidParams();
      params.variantIds = [];
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(aggregate.getVariantIds()).toEqual([]);
    });

    test("should create a positions aggregate without variantIds param", () => {
      const aggregate = VariantPositionsWithinProductAggregate.create({
        id: randomUUIDv7(),
        productId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
      });

      expect(aggregate.getVariantIds()).toEqual([]);
    });
  });

  describe("getVariantPosition", () => {
    test("should return correct position for variant", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(aggregate.getVariantPosition(params.variantIds[0]!)).toBe(0);
      expect(aggregate.getVariantPosition(params.variantIds[1]!)).toBe(1);
    });

    test("should return -1 for variant not in product", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(aggregate.getVariantPosition("nonexistent")).toBe(-1);
    });
  });

  describe("reorder", () => {
    test("should reorder variants", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);
      aggregate.uncommittedEvents = [];

      const newOrder = [params.variantIds[1]!, params.variantIds[0]!];
      aggregate.reorder(newOrder, "user-123");

      expect(aggregate.getVariantIds()).toEqual(newOrder);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "variantPositionsWithinProduct.reordered",
      );
    });

    test("should throw error when new order has different number of variants", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(() => aggregate.reorder([params.variantIds[0]!], "user-123")).toThrow(
        "New order must contain the same number of variants",
      );
    });

    test("should throw error when new order contains variant not in product", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(() =>
        aggregate.reorder([params.variantIds[0]!, "nonexistent"], "user-123"),
      ).toThrow("is not in this product");
    });
  });

  describe("addVariant", () => {
    test("should add variant to end by default", () => {
      const variantId1 = randomUUIDv7();
      const variantId2 = randomUUIDv7();
      const aggregate = VariantPositionsWithinProductAggregate.create({
        id: randomUUIDv7(),
        productId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        variantIds: [variantId1, variantId2],
      });
      aggregate.uncommittedEvents = [];

      const newVariantId = randomUUIDv7();
      aggregate.addVariant(newVariantId, "user-123");

      expect(aggregate.getVariantIds()).toEqual([variantId1, variantId2, newVariantId]);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "variantPositionsWithinProduct.variant_added",
      );
    });

    test("should add variant at specific position", () => {
      const variantId1 = randomUUIDv7();
      const variantId2 = randomUUIDv7();
      const aggregate = VariantPositionsWithinProductAggregate.create({
        id: randomUUIDv7(),
        productId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        variantIds: [variantId1, variantId2],
      });
      aggregate.uncommittedEvents = [];

      const newVariantId = randomUUIDv7();
      aggregate.addVariant(newVariantId, "user-123", 1);

      expect(aggregate.getVariantIds()).toEqual([variantId1, newVariantId, variantId2]);
    });

    test("should add variant at position 0", () => {
      const variantId1 = randomUUIDv7();
      const variantId2 = randomUUIDv7();
      const aggregate = VariantPositionsWithinProductAggregate.create({
        id: randomUUIDv7(),
        productId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        variantIds: [variantId1, variantId2],
      });
      aggregate.uncommittedEvents = [];

      const newVariantId = randomUUIDv7();
      aggregate.addVariant(newVariantId, "user-123", 0);

      expect(aggregate.getVariantIds()).toEqual([newVariantId, variantId1, variantId2]);
    });

    test("should add variant to end if position is beyond length", () => {
      const variantId1 = randomUUIDv7();
      const variantId2 = randomUUIDv7();
      const aggregate = VariantPositionsWithinProductAggregate.create({
        id: randomUUIDv7(),
        productId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        variantIds: [variantId1, variantId2],
      });
      aggregate.uncommittedEvents = [];

      const newVariantId = randomUUIDv7();
      aggregate.addVariant(newVariantId, "user-123", 100);

      expect(aggregate.getVariantIds()).toEqual([variantId1, variantId2, newVariantId]);
    });

    test("should throw error when adding duplicate variant", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(() =>
        aggregate.addVariant(params.variantIds[0]!, "user-123"),
      ).toThrow("is already in this product");
    });
  });

  describe("removeVariant", () => {
    test("should remove variant from product", () => {
      const variantId1 = randomUUIDv7();
      const variantId2 = randomUUIDv7();
      const aggregate = VariantPositionsWithinProductAggregate.create({
        id: randomUUIDv7(),
        productId: randomUUIDv7(),
        correlationId: randomUUIDv7(),
        userId: "user-123",
        variantIds: [variantId1, variantId2],
      });
      aggregate.uncommittedEvents = [];

      aggregate.removeVariant(variantId1, "user-123");

      expect(aggregate.getVariantIds()).toEqual([variantId2]);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "variantPositionsWithinProduct.variant_removed",
      );
    });

    test("should throw error when removing variant not in product", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);

      expect(() => aggregate.removeVariant("nonexistent", "user-123")).toThrow(
        "is not in this product",
      );
    });
  });

  describe("archive", () => {
    test("should archive aggregate and clear variants", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);
      aggregate.uncommittedEvents = [];

      aggregate.archive("user-123");

      expect(aggregate.getVariantIds()).toEqual([]);
      expect(aggregate.version).toBe(1);
      expect(aggregate.uncommittedEvents).toHaveLength(1);
      expect(aggregate.uncommittedEvents[0]!.eventName).toBe(
        "variantPositionsWithinProduct.archived",
      );
    });
  });

  describe("loadFromSnapshot", () => {
    test("should load aggregate from snapshot", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);
      const snapshot = aggregate.toSnapshot();

      const loaded = VariantPositionsWithinProductAggregate.loadFromSnapshot({
        aggregateId: params.id,
        correlationId: params.correlationId,
        version: 0,
        payload: JSON.stringify(snapshot),
      });

      expect(loaded.id).toBe(params.id);
      expect(loaded.productId).toBe(params.productId);
      expect(loaded.getVariantIds()).toEqual(params.variantIds);
      expect(loaded.version).toBe(0);
      expect(loaded.uncommittedEvents).toHaveLength(0);
    });
  });

  describe("toSnapshot", () => {
    test("should return snapshot data", () => {
      const params = createValidParams();
      const aggregate = VariantPositionsWithinProductAggregate.create(params);
      const snapshot = aggregate.toSnapshot();

      expect(snapshot.productId).toBe(params.productId);
      expect(snapshot.variantIds).toEqual(params.variantIds);
      expect(snapshot.version).toBe(0);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.updatedAt).toBeInstanceOf(Date);
    });
  });
});
