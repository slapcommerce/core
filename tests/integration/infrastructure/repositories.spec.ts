import { expect, test, describe } from "bun:test";
import { redis } from "../../helpers/redis";
import { randomUUIDv7 } from "bun";
import type { DomainEvent } from "../../../src/domain/_base/domainEvent";
import {
  EventRepository,
  AggregateTypeRepository,
  SnapshotRepository,
} from "../../../src/infrastructure/repositories";
import {
  LuaCommandTransaction,
  RedisPrefix,
} from "../../../src/infrastructure/redis";
import { encode, decode } from "@msgpack/msgpack";
import {
  EventSerializer,
  registerTestEvent,
} from "../../../src/infrastructure/eventSerializer";
import {
  AggregateSerializer,
  registerTestAggregate,
} from "../../../src/infrastructure/aggregateSerializer";

// Test event class for simple test events
class TestEvent {
  static payloadFields = ["test", "value"] as const;
  static payloadVersion = 1;

  constructor(public params: any) {
    Object.assign(this, params);
  }
}

// Test event class for complex events
class ComplexTestEvent {
  static payloadFields = [
    "nested",
    "string",
    "number",
    "boolean",
    "nullValue",
  ] as const;
  static payloadVersion = 1;

  constructor(public params: any) {
    Object.assign(this, params);
  }
}

// Test aggregate class for snapshots
class TestAggregate {
  static stateFields = [
    "id",
    "version",
    "name",
    "price",
    "tags",
    "state",
    "eventCount",
    "metadata",
    "nestedArray",
    "map",
    "binaryData",
    "timestamp",
    "nullValue",
    "undefinedValue",
    "emptyString",
    "zero",
  ] as const;
  static stateVersion = 1;

  constructor(public params: any) {
    Object.assign(this, params);
  }
}

// Register test events and aggregates
// @ts-expect-error - TestEvent is not a DomainEvent
registerTestEvent("TestEvent", TestEvent);
// @ts-expect-error - TestEvent is not a DomainEvent
registerTestEvent("Event1", TestEvent);
// @ts-expect-error - TestEvent is not a DomainEvent
registerTestEvent("Event2", TestEvent);
// @ts-expect-error - TestEvent is not a DomainEvent
registerTestEvent("Event3", TestEvent);
// @ts-expect-error - ComplexTestEvent is not a DomainEvent
registerTestEvent("ComplexEvent", ComplexTestEvent);
// @ts-expect-error - ComplexTestEvent is not a DomainEvent
registerTestEvent("Event2", TestEvent);
// @ts-expect-error - ComplexTestEvent is not a DomainEvent
registerTestEvent("Event3", TestEvent);
// @ts-expect-error - ComplexTestEvent is not a DomainEvent
registerTestEvent("ComplexEvent", ComplexTestEvent);
// @ts-expect-error - ComplexTestEvent is not a DomainEvent
registerTestEvent("ComplexAggregateTypeEvent", ComplexTestEvent);

// Helper function to ensure aggregate type is registered
function ensureAggregateTypeRegistered(aggregateType: string) {
  registerTestAggregate(aggregateType, TestAggregate);
}

// Helper to create a test domain event
function createTestEvent(
  aggregateId: string,
  eventName: string = "TestEvent",
  version: number = 1
): DomainEvent<string, Record<string, unknown>> {
  return {
    occurredAt: new Date(),
    eventName,
    correlationId: randomUUIDv7(),
    aggregateId,
    version,
    payload: { test: "data", value: 123 },
  };
}

describe("EventRepository", () => {
  test("successfully adds event to per-aggregate stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, "TestEvent", 1);
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const eventRepo1 = new EventRepository(tx1, eventSerializer);
    await eventRepo1.add(event1);
    await tx1.commit();

    // Second transaction with wrong expected version
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const eventRepo2 = new EventRepository(tx2, eventSerializer);
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
      occurredAt: new Date(),
      eventName: "ComplexEvent",
      correlationId: randomUUIDv7(),
      aggregateId,
      version: 1,
      payload: complexPayload,
    };
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const aggregateTypeRepo1 = new AggregateTypeRepository(
      tx1,
      eventSerializer
    );
    await aggregateTypeRepo1.add(event1);

    // Second transaction
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const aggregateTypeRepo2 = new AggregateTypeRepository(
      tx2,
      eventSerializer
    );
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
      occurredAt: new Date(),
      eventName: "ComplexAggregateTypeEvent",
      correlationId: randomUUIDv7(),
      aggregateId,
      version: 1,
      payload: complexPayload,
    };
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventSerializer = new EventSerializer();
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);

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
    const eventSerializer = new EventSerializer();
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const eventRepo1 = new EventRepository(tx1, eventSerializer);
    const aggregateTypeRepo1 = new AggregateTypeRepository(
      tx1,
      eventSerializer
    );
    await eventRepo1.add(event1);
    await aggregateTypeRepo1.add(event1);
    await tx1.commit();

    // Second transaction with wrong expected version for per-aggregate
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const eventRepo2 = new EventRepository(tx2, eventSerializer);
    const aggregateTypeRepo2 = new AggregateTypeRepository(
      tx2,
      eventSerializer
    );

    // This has wrong version and should fail
    const wrongVersionEvent = createTestEvent(aggregateId, "Event2", 4);
    await eventRepo2.add(wrongVersionEvent);
    await aggregateTypeRepo2.add(wrongVersionEvent);

    // ACT & ASSERT
    // The transaction should fail due to version mismatch in per-aggregate stream
    await expect(tx2.commit()).rejects.toThrow(/Version mismatch/);
  });
});

describe("SnapshotRepository", () => {
  test("successfully saves snapshot to Redis", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const snapshotData = {
      id: aggregateId,
      version: 50,
      name: "Test Product",
      price: 99.99,
      tags: ["test", "snapshot"],
    };
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateSerializer = new AggregateSerializer();
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await snapshotRepo.add(aggregateId, 50, snapshotData, aggregateType);
    await tx.commit();

    // ASSERT
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    expect(storedSnapshot).toBeDefined();
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.id).toBe(aggregateId);
    expect(deserialized.version).toBe(50);
    expect(deserialized.name).toBe("Test Product");
  });

  test("successfully saves snapshot with complex nested data", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const complexSnapshot = {
      id: aggregateId,
      version: 100,
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags: ["tag1", "tag2"],
      },
      nestedArray: [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
      ],
      map: { key1: "value1", key2: "value2" },
    };
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateSerializer = new AggregateSerializer();
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await snapshotRepo.add(aggregateId, 100, complexSnapshot, aggregateType);
    await tx.commit();

    // ASSERT
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    expect(storedSnapshot).toBeDefined();
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.id).toBe(aggregateId);
    expect(deserialized.version).toBe(100);
  });

  test("snapshot is properly encoded with MessagePack", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const snapshotData = {
      version: 50,
      binaryData: new Uint8Array([1, 2, 3, 4, 5]),
      timestamp: Date.now(),
    };
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateSerializer = new AggregateSerializer();
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await snapshotRepo.add(aggregateId, 50, snapshotData, aggregateType);
    await tx.commit();

    // ASSERT
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    expect(storedSnapshot).toBeDefined();

    // Verify it's actually MessagePack encoded by deserializing it
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.version).toBe(50);
    expect(deserialized.timestamp).toBe(snapshotData.timestamp);
  });

  test("overwrites previous snapshot for same aggregate", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const snapshot1 = { id: aggregateId, version: 50, state: "old" };
    const snapshot2 = { id: aggregateId, version: 100, state: "new" };
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    // First snapshot
    const aggregateSerializer = new AggregateSerializer();
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const snapshotRepo1 = new SnapshotRepository(tx1, aggregateSerializer);
    await snapshotRepo1.add(aggregateId, 50, snapshot1, aggregateType);
    await tx1.commit();

    // ACT - Second snapshot overwrites first
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const snapshotRepo2 = new SnapshotRepository(tx2, aggregateSerializer);
    await snapshotRepo2.add(aggregateId, 100, snapshot2, aggregateType);
    await tx2.commit();

    // ASSERT
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.state).toBe("new");
    expect(deserialized.version).toBe(100);
  });

  test("saves multiple snapshots for different aggregates", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const snapshot1 = { id: aggregateId1, version: 50, name: "Product 1" };
    const snapshot2 = { id: aggregateId2, version: 100, name: "Product 2" };
    const snapshotKey1 = `snapshot:${aggregateType}:${aggregateId1}`;
    const snapshotKey2 = `snapshot:${aggregateType}:${aggregateId2}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateSerializer = new AggregateSerializer();
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await snapshotRepo.add(aggregateId1, 50, snapshot1, aggregateType);
    await snapshotRepo.add(aggregateId2, 100, snapshot2, aggregateType);
    await tx.commit();

    // ASSERT
    const storedSnapshot1 = await redis.getBuffer(snapshotKey1);
    const deserialized1 = await aggregateSerializer.deserialize(
      storedSnapshot1!
    );
    expect(deserialized1.id).toBe(aggregateId1);
    expect(deserialized1.name).toBe("Product 1");

    const storedSnapshot2 = await redis.getBuffer(snapshotKey2);
    const deserialized2 = await aggregateSerializer.deserialize(
      storedSnapshot2!
    );
    expect(deserialized2.id).toBe(aggregateId2);
    expect(deserialized2.name).toBe("Product 2");
  });

  test("handles empty snapshot data", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const emptySnapshot = {};
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateSerializer = new AggregateSerializer();
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await snapshotRepo.add(aggregateId, 0, emptySnapshot, aggregateType);
    await tx.commit();

    // ASSERT
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    expect(storedSnapshot).toBeDefined();
    // Just verify it can be deserialized
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized).toBeDefined();
  });

  test("handles snapshot with null and undefined values", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const snapshotData = {
      id: aggregateId,
      version: 50,
      nullValue: null,
      undefinedValue: undefined,
      emptyString: "",
      zero: 0,
    };
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const aggregateSerializer = new AggregateSerializer();
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await snapshotRepo.add(aggregateId, 50, snapshotData, aggregateType);
    await tx.commit();

    // ASSERT
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.id).toBe(aggregateId);
    expect(deserialized.version).toBe(50);
    // Note: AggregateSerializer converts null to undefined during deserialization
    expect(deserialized.nullValue).toBeUndefined();
    expect(deserialized.emptyString).toBe("");
    expect(deserialized.zero).toBe(0);
    // Note: undefined values are typically omitted in MessagePack
  });
});

describe("SnapshotRepository with EventRepository integration", () => {
  test("successfully commits events and snapshot in same transaction", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const event = createTestEvent(aggregateId, "Event1", 1);
    const snapshotData = { id: aggregateId, version: 1, state: "current" };
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventSerializer = new EventSerializer();
    const aggregateSerializer = new AggregateSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await eventRepo.add(event);
    await snapshotRepo.add(aggregateId, 1, snapshotData, aggregateType);
    await tx.commit();

    // ASSERT
    // Verify event was added
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBeGreaterThanOrEqual(1);

    // Verify snapshot was saved
    const storedSnapshot = await redis.getBuffer(snapshotKey);
    expect(storedSnapshot).toBeDefined();
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.id).toBe(aggregateId);
    expect(deserialized.state).toBe("current");
  });

  test("atomically commits events, aggregate type events, and snapshot", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const event = createTestEvent(aggregateId, "Event1", 1);
    const snapshotData = { id: aggregateId, version: 1, state: "snapshotted" };
    const perAggregateStream = `${RedisPrefix.EVENTS}${aggregateId}`;
    const aggregateTypeStream = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventSerializer = new EventSerializer();
    const aggregateSerializer = new AggregateSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);
    const aggregateTypeRepo = new AggregateTypeRepository(tx, eventSerializer);
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    await eventRepo.add(event);
    await aggregateTypeRepo.add(event);
    await snapshotRepo.add(aggregateId, 1, snapshotData, aggregateType);
    await tx.commit();

    // ASSERT
    // All three operations should have succeeded
    const perAggregateEvents = await redis.xrange(perAggregateStream, "-", "+");
    expect(perAggregateEvents.length).toBe(1);

    const aggregateTypeEvents = await redis.xrange(
      aggregateTypeStream,
      "-",
      "+"
    );
    expect(aggregateTypeEvents.length).toBeGreaterThanOrEqual(1);

    const storedSnapshot = await redis.getBuffer(snapshotKey);
    expect(storedSnapshot).toBeDefined();
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.id).toBe(aggregateId);
    expect(deserialized.state).toBe("snapshotted");
  });

  test("commits multiple events and creates snapshot at specific version", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const events = [
      createTestEvent(aggregateId, "Event1", 1),
      createTestEvent(aggregateId, "Event2", 2),
      createTestEvent(aggregateId, "Event3", 3),
    ];
    const snapshotData = { id: aggregateId, version: 3, eventCount: 3 };
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;
    const snapshotKey = `snapshot:${aggregateType}:${aggregateId}`;

    const tx = new LuaCommandTransaction(redis, commandId, aggregateType);
    const eventSerializer = new EventSerializer();
    const aggregateSerializer = new AggregateSerializer();
    const eventRepo = new EventRepository(tx, eventSerializer);
    const snapshotRepo = new SnapshotRepository(tx, aggregateSerializer);

    // ACT
    for (const event of events) {
      await eventRepo.add(event);
    }
    // Take snapshot after 3rd event
    await snapshotRepo.add(aggregateId, 3, snapshotData, aggregateType);
    await tx.commit();

    // ASSERT
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBe(3);

    const storedSnapshot = await redis.getBuffer(snapshotKey);
    const deserialized = await aggregateSerializer.deserialize(storedSnapshot!);
    expect(deserialized.version).toBe(3);
    expect(deserialized.eventCount).toBe(3);
  });

  test("snapshot operation doesn't interfere with version checking", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    ensureAggregateTypeRegistered(aggregateType);

    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const snapshotData1 = { version: 1 };

    // First transaction establishes version
    const eventSerializer = new EventSerializer();
    const aggregateSerializer = new AggregateSerializer();
    const tx1 = new LuaCommandTransaction(redis, commandId1, aggregateType);
    const eventRepo1 = new EventRepository(tx1, eventSerializer);
    const snapshotRepo1 = new SnapshotRepository(tx1, aggregateSerializer);
    await eventRepo1.add(event1);
    await snapshotRepo1.add(aggregateId, 1, snapshotData1, aggregateType);
    await tx1.commit();

    // Second transaction with wrong version
    const tx2 = new LuaCommandTransaction(redis, commandId2, aggregateType);
    const eventRepo2 = new EventRepository(tx2, eventSerializer);
    const snapshotRepo2 = new SnapshotRepository(tx2, aggregateSerializer);

    const wrongVersionEvent = createTestEvent(aggregateId, "Event2", 4);
    await eventRepo2.add(wrongVersionEvent);
    await snapshotRepo2.add(aggregateId, 4, { version: 4 }, aggregateType);

    // ACT & ASSERT
    // Should fail due to version mismatch in event stream
    await expect(tx2.commit()).rejects.toThrow(/Version mismatch/);
  });
});
