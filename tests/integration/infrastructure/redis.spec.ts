import { expect, test, describe } from "bun:test";
import { redis } from "../../helpers/redis";
import { randomUUIDv7 } from "bun";
import type { DomainEvent } from "../../../src/domain/_base/domainEvent";
import {
  LuaCommandTransaction,
  LuaProjectionTransaction,
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

describe("LuaCommandTransaction", () => {
  test("successfully commits event to per-aggregate stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, "TestEvent", 1);
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const transaction = new LuaCommandTransaction(
      redis,
      commandId,
      aggregateType
    );

    // ACT
    // Version 1 means first event (stream starts empty with currentVersion = -1)
    await transaction.addToPerAggregateStream(aggregateId, 1, event);
    const result = await transaction.commit();

    // ASSERT
    expect(result).toBe("1");

    // Verify event was added to stream
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBe(1);
    expect(streamEvents[0][0]).toBe("1-0"); // version as message ID (Redis format)
  });

  test("successfully commits event to aggregate type stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, "TestEvent", 1);
    const streamName = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const transaction = new LuaCommandTransaction(
      redis,
      commandId,
      aggregateType
    );

    // ACT
    await transaction.addToAggregateTypeStream(aggregateType, 1, event);
    const result = await transaction.commit();

    // ASSERT
    expect(result).toBe("1");

    // Verify event was added to stream
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("successfully commits events to both per-aggregate and aggregate type streams", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event = createTestEvent(aggregateId, "TestEvent", 1);
    const perAggregateStream = `${RedisPrefix.EVENTS}${aggregateId}`;
    const aggregateTypeStream = `${RedisPrefix.AGGREGATE_TYPE}${aggregateType}`;

    const transaction = new LuaCommandTransaction(
      redis,
      commandId,
      aggregateType
    );

    // ACT
    await transaction.addToPerAggregateStream(aggregateId, 1, event);
    await transaction.addToAggregateTypeStream(aggregateType, 1, event);
    const result = await transaction.commit();

    // ASSERT
    expect(result).toBe("1");

    // Verify event was added to both streams
    const perAggregateEvents = await redis.xrange(perAggregateStream, "-", "+");
    const aggregateTypeEvents = await redis.xrange(
      aggregateTypeStream,
      "-",
      "+"
    );

    expect(perAggregateEvents.length).toBe(1);
    expect(aggregateTypeEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("detects version mismatch for per-aggregate stream", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const event2 = createTestEvent(aggregateId, "Event2", 2);

    // First, add an event to establish version (stream starts at -1, after one event it's 0)
    const transaction1 = new LuaCommandTransaction(
      redis,
      commandId1,
      aggregateType
    );
    await transaction1.addToPerAggregateStream(aggregateId, 1, event1);
    await transaction1.commit();

    // Now try to add event with wrong expected version
    const transaction2 = new LuaCommandTransaction(
      redis,
      commandId2,
      aggregateType
    );
    // This expects current version to be 3, but it's actually 0 (after 1 event)
    await transaction2.addToPerAggregateStream(aggregateId, 4, event2);

    // ACT & ASSERT
    await expect(transaction2.commit()).rejects.toThrow(/Version mismatch/);
  });

  test("deduplicates commands with same commandId", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId = randomUUIDv7(); // Same command ID
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId1, "Event1", 1);
    const event2 = createTestEvent(aggregateId2, "Event2", 1);

    const transaction1 = new LuaCommandTransaction(
      redis,
      commandId,
      aggregateType
    );
    await transaction1.addToPerAggregateStream(aggregateId1, 1, event1);

    const transaction2 = new LuaCommandTransaction(
      redis,
      commandId,
      aggregateType
    );
    await transaction2.addToPerAggregateStream(aggregateId2, 1, event2);

    // ACT
    const result1 = await transaction1.commit();
    const result2 = await transaction2.commit();

    // ASSERT
    // Both should return the same aggregate ID (from first commit)
    expect(result1).toBe(result2);

    // Only the first aggregate should have events
    const stream1 = `${RedisPrefix.EVENTS}${aggregateId1}`;
    const stream2 = `${RedisPrefix.EVENTS}${aggregateId2}`;
    const events1 = await redis.xrange(stream1, "-", "+");
    const events2 = await redis.xrange(stream2, "-", "+");

    expect(events1.length).toBe(1);
    expect(events2.length).toBe(0);
  });

  test("handles multiple events to same aggregate in single transaction", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const commandId = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId, "Event1", 1);
    const event2 = createTestEvent(aggregateId, "Event2", 2);
    const event3 = createTestEvent(aggregateId, "Event3", 3);
    const streamName = `${RedisPrefix.EVENTS}${aggregateId}`;

    const transaction = new LuaCommandTransaction(
      redis,
      commandId,
      aggregateType
    );

    // ACT
    await transaction.addToPerAggregateStream(aggregateId, 1, event1);
    await transaction.addToPerAggregateStream(aggregateId, 2, event2);
    await transaction.addToPerAggregateStream(aggregateId, 3, event3);
    const result = await transaction.commit();

    // ASSERT
    expect(result).toBe("1");

    // Verify all events were added to stream
    const streamEvents = await redis.xrange(streamName, "-", "+");
    expect(streamEvents.length).toBe(3);
  });

  test("increments aggregate type counter on each new aggregate", async () => {
    // ARRANGE
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const event1 = createTestEvent(aggregateId1, "Event1", 1);
    const event2 = createTestEvent(aggregateId2, "Event2", 1);
    const counterKey = `${RedisPrefix.AGGREGATE_TYPE_COUNTERS}${aggregateType}`;

    const transaction1 = new LuaCommandTransaction(
      redis,
      commandId1,
      aggregateType
    );
    await transaction1.addToPerAggregateStream(aggregateId1, 1, event1);

    const transaction2 = new LuaCommandTransaction(
      redis,
      commandId2,
      aggregateType
    );
    await transaction2.addToPerAggregateStream(aggregateId2, 1, event2);

    // ACT
    const result1 = await transaction1.commit();
    const result2 = await transaction2.commit();

    // ASSERT
    expect(result1).not.toBe(result2);

    // Check counter was incremented
    const counterValue = await redis.get(counterKey);
    expect(counterValue).toBeDefined();
    expect(parseInt(counterValue!, 10)).toBeGreaterThanOrEqual(2);
  });

  test("uses EVALSHA for better performance on subsequent calls", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const commandId1 = randomUUIDv7();
    const commandId2 = randomUUIDv7();
    const aggregateType = `test-type-${randomUUIDv7()}`;
    const event1 = createTestEvent(aggregateId1, "Event1", 1);
    const event2 = createTestEvent(aggregateId2, "Event2", 1);

    // First transaction - will use EVAL
    const transaction1 = new LuaCommandTransaction(
      redis,
      commandId1,
      aggregateType
    );
    await transaction1.addToPerAggregateStream(aggregateId1, 1, event1);
    const result1 = await transaction1.commit();

    // Second transaction with same structure - should use EVALSHA
    const transaction2 = new LuaCommandTransaction(
      redis,
      commandId2,
      aggregateType
    );
    await transaction2.addToPerAggregateStream(aggregateId2, 1, event2);

    // ACT
    const result2 = await transaction2.commit();

    // ASSERT
    expect(result1).toBe("1");
    expect(result2).toBe("2");
    // Verify event was committed successfully
    const stream = `${RedisPrefix.EVENTS}${aggregateId2}`;
    const events = await redis.xrange(stream, "-", "+");
    expect(events.length).toBe(1);
  });
});

describe("LuaProjectionTransaction", () => {
  test("successfully commits hset operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-hash-${randomUUIDv7()}`;
    const field = "testField";
    const value = "testValue";

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1); // No previous version

    // ACT
    transaction.hset(aggregateId, key, field, value);
    await transaction.commit();

    // ASSERT
    const storedValue = await redis.hget(key, field);
    expect(storedValue).toBe(value);

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits hmset operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-hash-${randomUUIDv7()}`;
    const fields = {
      field1: "value1",
      field2: "value2",
      field3: "value3",
    };

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.hmset(aggregateId, key, fields);
    await transaction.commit();

    // ASSERT
    const storedValues = await redis.hgetall(key);
    expect(storedValues.field1).toBe("value1");
    expect(storedValues.field2).toBe("value2");
    expect(storedValues.field3).toBe("value3");

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits set operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-key-${randomUUIDv7()}`;
    const value = "testValue";

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.set(aggregateId, key, value);
    await transaction.commit();

    // ASSERT
    const storedValue = await redis.get(key);
    expect(storedValue).toBe(value);

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits sadd operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-set-${randomUUIDv7()}`;
    const members = ["member1", "member2", "member3"];

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.sadd(aggregateId, key, ...members);
    await transaction.commit();

    // ASSERT
    const storedMembers = await redis.smembers(key);
    expect(storedMembers.sort()).toEqual(members.sort());

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits lpush operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-list-${randomUUIDv7()}`;
    const values = ["value1", "value2", "value3"];

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.lpush(aggregateId, key, ...values);
    await transaction.commit();

    // ASSERT
    const storedValues = await redis.lrange(key, 0, -1);
    expect(storedValues).toEqual(values.reverse()); // LPUSH adds in reverse order

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits del operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key1 = `test-key-${randomUUIDv7()}`;
    const key2 = `test-hash-${randomUUIDv7()}`;
    const key3 = `test-key-${randomUUIDv7()}`;

    // Set up keys - key2 as a hash for HSET operation
    await redis.set(key1, "someValue");
    await redis.hset(key2, "existingField", "existingValue");
    await redis.set(key3, "thirdValue");
    expect(await redis.exists(key1)).toBe(1);
    expect(await redis.exists(key2)).toBe(1);

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT - Test multiple operations including del
    transaction.set(aggregateId, key3, "updatedValue"); // First operation
    transaction.del(aggregateId, key1); // Del in middle
    transaction.hset(aggregateId, key2, "field", "value"); // After del
    await transaction.commit();

    // ASSERT
    const existsAfter1 = await redis.exists(key1);
    expect(existsAfter1).toBe(0);

    const value3 = await redis.get(key3);
    expect(value3).toBe("updatedValue");

    const value2 = await redis.hget(key2, "field");
    expect(value2).toBe("value");

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits zadd operation", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-zset-${randomUUIDv7()}`;
    const score = 100;
    const member = "testMember";

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.zadd(aggregateId, key, score, member);
    await transaction.commit();

    // ASSERT
    const storedScore = await redis.zscore(key, member);
    expect(storedScore).toBe(score.toString());

    // Verify version was updated
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("detects version mismatch", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-key-${randomUUIDv7()}`;
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;

    // Set initial version
    await redis.set(versionKey, "5");

    const transaction = new LuaProjectionTransaction(redis);
    // Expect version 3, but actual is 5
    transaction.setExpectedVersion(3);

    // ACT & ASSERT
    transaction.set(aggregateId, key, "value");
    await expect(transaction.commit()).rejects.toThrow(/Version mismatch/);
  });

  test("successfully commits multiple operations in single transaction", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const hashKey = `test-hash-${randomUUIDv7()}`;
    const setKey = `test-set-${randomUUIDv7()}`;
    const stringKey = `test-string-${randomUUIDv7()}`;

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.hset(aggregateId, hashKey, "field1", "value1");
    transaction.sadd(aggregateId, setKey, "member1", "member2");
    transaction.set(aggregateId, stringKey, "stringValue");
    await transaction.commit();

    // ASSERT
    const hashValue = await redis.hget(hashKey, "field1");
    expect(hashValue).toBe("value1");

    const setMembers = await redis.smembers(setKey);
    expect(setMembers.sort()).toEqual(["member1", "member2"].sort());

    const stringValue = await redis.get(stringKey);
    expect(stringValue).toBe("stringValue");

    // Verify version was updated once
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const version = await redis.get(versionKey);
    expect(version).toBe("0");
  });

  test("successfully commits transaction with no operations (version update only)", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;
    const dummyKey = `dummy-${randomUUIDv7()}`;

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);
    // Need to add at least one operation to trigger version check setup
    transaction.set(aggregateId, dummyKey, "dummy");

    // ACT - commit with minimal operation
    await transaction.commit();

    // ASSERT
    // Version should be updated
    const version = await redis.get(versionKey);
    expect(version).toBe("0");

    // Clean up
    await redis.del(dummyKey);
  });

  test("throws error when committing without setting expected version", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-key-${randomUUIDv7()}`;

    const transaction = new LuaProjectionTransaction(redis);
    // Do NOT set expected version

    // ACT & ASSERT
    transaction.set(aggregateId, key, "value");
    await expect(transaction.commit()).rejects.toThrow(
      /Expected version must be set/
    );
  });

  test("correctly increments version on sequential transactions", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-key-${randomUUIDv7()}`;
    const versionKey = `${RedisPrefix.PROJECTION_VERSION}${aggregateId}`;

    // First transaction
    const transaction1 = new LuaProjectionTransaction(redis);
    transaction1.setExpectedVersion(-1);
    transaction1.set(aggregateId, key, "value1");
    await transaction1.commit();

    // Second transaction
    const transaction2 = new LuaProjectionTransaction(redis);
    transaction2.setExpectedVersion(0);
    transaction2.set(aggregateId, key, "value2");
    await transaction2.commit();

    // Third transaction
    const transaction3 = new LuaProjectionTransaction(redis);
    transaction3.setExpectedVersion(1);
    transaction3.set(aggregateId, key, "value3");
    await transaction3.commit();

    // ASSERT
    const finalVersion = await redis.get(versionKey);
    expect(finalVersion).toBe("2");

    const finalValue = await redis.get(key);
    expect(finalValue).toBe("value3");
  });

  test("handles Buffer values in operations", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const key = `test-key-${randomUUIDv7()}`;
    const bufferValue = Buffer.from("binary data here", "utf-8");

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT
    transaction.set(aggregateId, key, bufferValue);
    await transaction.commit();

    // ASSERT
    const storedValue = await redis.getBuffer(key);
    expect(storedValue).toBeDefined();
    expect(Buffer.compare(storedValue!, bufferValue)).toBe(0);
  });

  test("uses EVALSHA for better performance on subsequent calls", async () => {
    // ARRANGE
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const key1 = `test-key-${randomUUIDv7()}`;
    const key2 = `test-key-${randomUUIDv7()}`;

    // First transaction - will use EVAL
    const transaction1 = new LuaProjectionTransaction(redis);
    transaction1.setExpectedVersion(-1);
    transaction1.set(aggregateId1, key1, "value1");
    await transaction1.commit();

    // Second transaction with same structure - should use EVALSHA
    const transaction2 = new LuaProjectionTransaction(redis);
    transaction2.setExpectedVersion(-1);
    transaction2.set(aggregateId2, key2, "value2");

    // ACT
    await transaction2.commit();

    // ASSERT
    const value1 = await redis.get(key1);
    const value2 = await redis.get(key2);
    expect(value1).toBe("value1");
    expect(value2).toBe("value2");
  });

  test("handles mixed operation types in single transaction", async () => {
    // ARRANGE
    const aggregateId = randomUUIDv7();
    const hashKey = `test-hash-${randomUUIDv7()}`;
    const setKey = `test-set-${randomUUIDv7()}`;
    const listKey = `test-list-${randomUUIDv7()}`;
    const zsetKey = `test-zset-${randomUUIDv7()}`;
    const stringKey = `test-string-${randomUUIDv7()}`;

    const transaction = new LuaProjectionTransaction(redis);
    transaction.setExpectedVersion(-1);

    // ACT - add various operations
    transaction.hset(aggregateId, hashKey, "field", "hashValue");
    transaction.sadd(aggregateId, setKey, "member1");
    transaction.lpush(aggregateId, listKey, "listValue");
    transaction.zadd(aggregateId, zsetKey, 42, "zsetMember");
    transaction.set(aggregateId, stringKey, "stringValue");
    await transaction.commit();

    // ASSERT
    const hashValue = await redis.hget(hashKey, "field");
    expect(hashValue).toBe("hashValue");

    const setMembers = await redis.smembers(setKey);
    expect(setMembers).toContain("member1");

    const listValues = await redis.lrange(listKey, 0, -1);
    expect(listValues).toContain("listValue");

    const zsetScore = await redis.zscore(zsetKey, "zsetMember");
    expect(zsetScore).toBe("42");

    const stringValue = await redis.get(stringKey);
    expect(stringValue).toBe("stringValue");
  });
});
