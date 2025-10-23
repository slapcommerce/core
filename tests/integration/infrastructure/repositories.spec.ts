import { expect, test, describe } from "bun:test";
import { redis } from "../../helpers/redis";
import { randomUUIDv7 } from "bun";
import type { DomainEvent } from "../../../src/domain/_base/domainEvent";
import {
  EventRepository,
  AggregateTypeRepository,
} from "../../../src/infrastructure/repositories";
import {
  LuaCommandTransaction,
  RedisPrefix,
} from "../../../src/infrastructure/redis";

// Helper to create a test domain event
function createTestEvent(
  aggregateId: string,
  eventName: string = "TestEvent",
  version: number = 1
): DomainEvent<string, Record<string, unknown>> {
  return {
    createdAt: new Date(),
    eventName,
    correlationId: randomUUIDv7(),
    aggregateId,
    version,
    payload: { test: "data", value: 123 },
    committed: true,
  };
}

describe("EventRepository", () => {
  test("successfully adds event to per-aggregate stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, aggregateType, 1);
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);

    // ACT
    await eventRepo.add(event);
    await tx.commit();

    // ASSERT
    // Verify event was added to stream
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBe(1);
    expect(streamEvents[0][0]).toBe("1-0"); // version as message ID (Redis format)
  });

  test("successfully adds multiple events to same aggregate", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const event2 = createTestEvent(aggregateId, "Event2", 2);
    const event3 = createTestEvent(aggregateId, "Event3", 3);
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);

    // ACT
    await eventRepo.add(event1);
    await eventRepo.add(event2);
    await eventRepo.add(event3);
    await tx.commit();

    // ASSERT
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBe(3);
    expect(streamEvents[0][0]).toBe("1-0");
    expect(streamEvents[1][0]).toBe("2-0");
    expect(streamEvents[2][0]).toBe("3-0");
  });

  test("successfully adds events to different aggregates in same transaction", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId1, "Event1", 1);
    const event2 = createTestEvent(aggregateId2, "Event2", 1);
    const streamName1 = `${RedisPrefix.EVENTS}${aggregateId1}`;
    const streamName2 = `${RedisPrefix.EVENTS}${aggregateId2}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);

    // ACT
    await eventRepo.add(event1);
    await eventRepo.add(event2);
    await tx.commit();

    // ASSERT
    const streamEvents1 = await redis.xrange(streamName1, "-", "+");
    const streamEvents2 = await redis.xrange(streamName2, "-", "+");
    expect(streamEvents1.length).toBe(1);
    expect(streamEvents2.length).toBe(1);
  });

  test("handles version conflict detection", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const event2 = createTestEvent(aggregateId, "Event2", 2);

    // First transaction to establish version
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const eventRepo1 = new EventRepository(tx1);
    await eventRepo1.add(event1);
    await tx1.commit();

    // Second transaction with wrong expected version
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const eventRepo2 = new EventRepository(tx2);
    // This expects current version to be 3, but it's actually 0 (after 1 event)
    const wrongVersionEvent = createTestEvent(aggregateId, "Event2", 4);
    await eventRepo2.add(wrongVersionEvent);

    // ACT & ASSERT
    await expect(tx2.commit()).rejects.toThrow(/Version mismatch/);
  });

  test("successfully adds event with complex payload", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const complexPayload = {
      nested: {
        object: { value: 123 },
        array: [1, 2, 3],
      },
      string: "test",
      number: 456,
      boolean: true,
      nullValue: null,
    };
    const event: DomainEvent<string, Record<string, unknown>> = {
      createdAt: new Date(),
      eventName: "ComplexEvent",
      correlationId: randomUUIDv7(),
      aggregateId,
      version: 1,
      payload: complexPayload,
      committed: true,
    };
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);

    // ACT
    await eventRepo.add(event);
    await tx.commit();

    // ASSERT
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBe(1);
  });
});

describe("AggregateTypeRepository", () => {
  test("successfully adds event to aggregate type stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, "TestEvent", 1);
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateTypeRepo = new AggregateTypeRepository(tx);

    // ACT
    await aggregateTypeRepo.add(event);
    await tx.commit();

    // ASSERT
    // Verify event was added to stream
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("successfully adds multiple events to aggregate type stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const event2 = createTestEvent(aggregateId, "Event2", 2);
    const event3 = createTestEvent(aggregateId, "Event3", 3);
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateTypeRepo = new AggregateTypeRepository(tx);

    // ACT
    await aggregateTypeRepo.add(event1);
    await aggregateTypeRepo.add(event2);
    await aggregateTypeRepo.add(event3);
    await tx.commit();

    // ASSERT
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBeGreaterThanOrEqual(3);
  });

  test("successfully adds events from different aggregates to same type stream", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId1, "Event1", 1);
    const event2 = createTestEvent(aggregateId2, "Event2", 1);
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    // First transaction
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const aggregateTypeRepo1 = new AggregateTypeRepository(tx1);
    await aggregateTypeRepo1.add(event1);

    // Second transaction
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const aggregateTypeRepo2 = new AggregateTypeRepository(tx2);
    await aggregateTypeRepo2.add(event2);

    // ACT
    await tx1.commit();
    await tx2.commit();

    // ASSERT
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBeGreaterThanOrEqual(2);
  });

  test("successfully adds event with complex payload to aggregate type stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const complexPayload = {
      nested: {
        object: { value: 123 },
        array: [1, 2, 3],
      },
      metadata: {
        userId: randomUUIDv7(),
        timestamp: new Date().toISOString(),
      },
    };
    const event: DomainEvent<string, Record<string, unknown>> = {
      createdAt: new Date(),
      eventName: "ComplexAggregateTypeEvent",
      correlationId: randomUUIDv7(),
      aggregateId,
      version: 1,
      payload: complexPayload,
      committed: true,
    };
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateTypeRepo = new AggregateTypeRepository(tx);

    // ACT
    await aggregateTypeRepo.add(event);
    await tx.commit();

    // ASSERT
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBeGreaterThanOrEqual(1);
  });
});

describe("EventRepository and AggregateTypeRepository integration", () => {
  test("successfully adds events to both per-aggregate and aggregate type streams", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, "TestEvent", 1);
    const perAggregateStream = `${RedisPrefix.EVENTS}${aggregateId}`;
    const aggregateTypeStream = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);
    const aggregateTypeRepo = new AggregateTypeRepository(tx);

    // ACT
    await eventRepo.add(event);
    await aggregateTypeRepo.add(event);
    await tx.commit();

    // ASSERT
    const perAggregateEvents = await redis.xrange(perAggregateStream, "-", "+");
    const aggregateTypeEvents = await redis.xrange(
      aggregateTypeStream,
      "-",
      "+"
    );
    expect(perAggregateEvents.length).toBe(1);
    expect(aggregateTypeEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("successfully adds multiple events to both streams", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const event2 = createTestEvent(aggregateId, "Event2", 2);
    const perAggregateStream = `${RedisPrefix.EVENTS}${aggregateId}`;
    const aggregateTypeStream = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);
    const aggregateTypeRepo = new AggregateTypeRepository(tx);

    // ACT
    await eventRepo.add(event1);
    await aggregateTypeRepo.add(event1);
    await eventRepo.add(event2);
    await aggregateTypeRepo.add(event2);
    await tx.commit();

    // ASSERT
    const perAggregateEvents = await redis.xrange(perAggregateStream, "-", "+");
    const aggregateTypeEvents = await redis.xrange(
      aggregateTypeStream,
      "-",
      "+"
    );
    expect(perAggregateEvents.length).toBe(2);
    expect(aggregateTypeEvents.length).toBeGreaterThanOrEqual(2);
  });

  test("handles mixed operations with multiple aggregates and types", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId1, "Event1", 1);
    const event2 = createTestEvent(aggregateId2, "Event2", 1);
    const perAggregateStream1 = `${RedisPrefix.EVENTS}${aggregateId1}`;
    const perAggregateStream2 = `${RedisPrefix.EVENTS}${aggregateId2}`;
    const aggregateTypeStream = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventRepo = new EventRepository(tx);
    const aggregateTypeRepo = new AggregateTypeRepository(tx);

    // ACT
    await eventRepo.add(event1);
    await aggregateTypeRepo.add(event1);
    await eventRepo.add(event2);
    await aggregateTypeRepo.add(event2);
    await tx.commit();

    // ASSERT
    const perAggregateEvents1 = await redis.xrange(
      perAggregateStream1,
      "-",
      "+"
    );
    const perAggregateEvents2 = await redis.xrange(
      perAggregateStream2,
      "-",
      "+"
    );
    const aggregateTypeEvents = await redis.xrange(
      aggregateTypeStream,
      "-",
      "+"
    );
    expect(perAggregateEvents1.length).toBe(1);
    expect(perAggregateEvents2.length).toBe(1);
    expect(aggregateTypeEvents.length).toBeGreaterThanOrEqual(2);
  });

  test("version conflict in EventRepository doesn't affect AggregateTypeRepository", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);

    // First transaction to establish version
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const eventRepo1 = new EventRepository(tx1);
    const aggregateTypeRepo1 = new AggregateTypeRepository(tx1);
    await eventRepo1.add(event1);
    await aggregateTypeRepo1.add(event1);
    await tx1.commit();

    // Second transaction with wrong expected version for per-aggregate
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const eventRepo2 = new EventRepository(tx2);
    const aggregateTypeRepo2 = new AggregateTypeRepository(tx2);

    // This has wrong version and should fail
    const wrongVersionEvent = createTestEvent(aggregateId, "Event2", 4);
    await eventRepo2.add(wrongVersionEvent);
    await aggregateTypeRepo2.add(wrongVersionEvent);

    // ACT & ASSERT
    // The transaction should fail due to version mismatch in per-aggregate stream
    await expect(tx2.commit()).rejects.toThrow(/Version mismatch/);
  });
});
