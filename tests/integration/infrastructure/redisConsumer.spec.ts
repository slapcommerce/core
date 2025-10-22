import { RedisAggregateTypeConsumer } from "../../../src/infrastructure/redisConsumer";
import { expect, test, describe } from "bun:test";
import { redis } from "../../helpers/redis";
import { randomUUIDv7 } from "bun";
import type { DomainEvent } from "../../../src/domain/_base/domainEvent";
import { encryptEvent } from "../../../src/infrastructure/utils/encryption";

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

// Helper to add encrypted event to a stream
async function addEventToStream(
  streamKey: string,
  event: DomainEvent<string, Record<string, unknown>>
): Promise<string> {
  const encryptedEvent = await encryptEvent(event);
  const eventBuffer = Buffer.from(encryptedEvent).toString("binary");
  const messageId = await redis.xadd(streamKey, "*", "event", eventBuffer);
  if (!messageId) {
    throw new Error("Failed to add message to stream");
  }
  return messageId;
}

// Helper to wait for a condition with timeout
async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

describe("RedisAggregateTypeConsumer", () => {
  test("consumes and processes new messages successfully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries: 3,
    });

    // Start consumer in background
    const consumerPromise = consumer.start();

    // Wait for consumer groups to be initialized
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT
    const event = createTestEvent(aggregateId);
    await addEventToStream(streamKey, event);

    // Wait for message to be processed
    await waitFor(async () => processedEvents.length > 0, 3000);

    // ASSERT
    expect(processedEvents).toHaveLength(1);
    expect(processedEvents[0].aggregateId).toBe(aggregateId);
    expect(processedEvents[0].eventName).toBe("TestEvent");
    expect(processedEvents[0].payload).toEqual({ test: "data", value: 123 });

    // Verify message was acknowledged (no pending messages)
    const pendingCount = await consumer.getPendingCount(streamKey);
    expect(pendingCount).toBe(0);

    // Stop consumer
    await consumer.stop();
  });

  test("creates consumer group if it doesn't exist", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const eventHandler = {
      handle: async () => {},
    };

    // ACT
    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ASSERT
    const groups = (await redis.xinfo("GROUPS", streamKey)) as any[][];
    const groupNames = groups
      .map((group: any[]) => {
        const nameIdx = group.indexOf("name");
        return nameIdx !== -1 ? group[nameIdx + 1] : null;
      })
      .filter((name): name is string => name !== null);
    expect(groupNames).toContain(consumerGroupName);

    // Cleanup
    await consumer.stop();
  });

  test("handles existing consumer group without error", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    // Pre-create the consumer group
    await redis.xgroup("CREATE", streamKey, consumerGroupName, "0", "MKSTREAM");

    const eventHandler = {
      handle: async () => {},
    };

    // ACT - should not throw
    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ASSERT - no error thrown
    const groups = (await redis.xinfo("GROUPS", streamKey)) as any[];
    expect(groups.length).toBeGreaterThan(0);

    // Cleanup
    await consumer.stop();
  });

  test("processes pending messages on startup", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    // Create consumer group and add message
    await redis.xgroup("CREATE", streamKey, consumerGroupName, "0", "MKSTREAM");
    const event = createTestEvent(aggregateId);
    await addEventToStream(streamKey, event);

    // Read message but don't acknowledge it (simulates a crash)
    await redis.xreadgroup(
      "GROUP",
      consumerGroupName,
      consumerName,
      "STREAMS",
      streamKey,
      ">"
    );

    // Verify message is in PEL
    const pendingBefore = await redis.xpending(streamKey, consumerGroupName);
    expect(parseInt(pendingBefore[0] as string, 10)).toBe(1);

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    // ACT - start new consumer instance
    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries: 3,
    });

    const consumerPromise = consumer.start();
    await waitFor(async () => processedEvents.length > 0, 10000);

    // ASSERT
    expect(processedEvents).toHaveLength(1);
    expect(processedEvents[0].aggregateId).toBe(aggregateId);

    // Verify message was acknowledged
    const pendingAfter = await consumer.getPendingCount(streamKey);
    expect(pendingAfter).toBe(0);

    // Cleanup
    await consumer.stop();
  });

  test("retries failed messages up to maxRetries", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    let attemptCount = 0;
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error("Processing failed");
        }
        // Success on 3rd attempt
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries: 3,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT
    const event = createTestEvent(aggregateId);
    await addEventToStream(streamKey, event);

    // Wait for retries to complete
    await waitFor(async () => attemptCount >= 3, 5000);

    // ASSERT
    expect(attemptCount).toBe(3);

    // Message should eventually be acknowledged
    await waitFor(async () => {
      const pending = await consumer.getPendingCount(streamKey);
      return pending === 0;
    }, 3000);

    const pendingCount = await consumer.getPendingCount(streamKey);
    expect(pendingCount).toBe(0);

    // Cleanup
    await consumer.stop();
  });

  test("moves message to DLQ after exceeding maxRetries", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;
    const maxRetries = 2;

    let attemptCount = 0;
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        attemptCount++;
        throw new Error("Processing always fails");
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT
    const event = createTestEvent(aggregateId);
    await addEventToStream(streamKey, event);

    // Wait for message to be moved to DLQ
    await waitFor(async () => {
      const dlqCount = await consumer.getDLQCount(streamKey);
      return dlqCount > 0;
    }, 10000);

    // ASSERT
    const dlqCount = await consumer.getDLQCount(streamKey);
    expect(dlqCount).toBe(1);

    // Message should be acknowledged (removed from PEL)
    const pendingCount = await consumer.getPendingCount(streamKey);
    expect(pendingCount).toBe(0);

    // Verify DLQ message content
    const dlqMessages = await consumer.readDLQMessages(streamKey, 10);
    expect(dlqMessages).toHaveLength(1);
    expect(dlqMessages[0].event.aggregateId).toBe(aggregateId);
    expect(dlqMessages[0].error).toContain("Max retries");
    expect(dlqMessages[0].originalStream).toBe(streamKey);

    // Cleanup
    await consumer.stop();
  });

  test("reads from multiple partitioned streams by date", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;

    // Create streams for today and yesterday
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const todayStream = `events:${aggregateType}:${todayStr}`;
    const yesterdayStream = `events:${aggregateType}:${yesterdayStr}`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 2, // Look back 2 days
      maxRetries: 3,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT - add events to both streams
    const todayEvent = createTestEvent(aggregateId, "TodayEvent");
    const yesterdayEvent = createTestEvent(aggregateId, "YesterdayEvent");

    await addEventToStream(todayStream, todayEvent);
    await addEventToStream(yesterdayStream, yesterdayEvent);

    // Wait for both messages to be processed
    await waitFor(async () => processedEvents.length >= 2, 5000);

    // ASSERT
    expect(processedEvents.length).toBeGreaterThanOrEqual(2);
    const eventNames = processedEvents.map((e) => e.eventName);
    expect(eventNames).toContain("TodayEvent");
    expect(eventNames).toContain("YesterdayEvent");

    // Cleanup
    await consumer.stop();
  });

  test("reprocesses DLQ message successfully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;
    const dlqStreamKey = `${streamKey}:dlq`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // Manually add a message to DLQ
    const event = createTestEvent(aggregateId);
    const encryptedEvent = await encryptEvent(event);
    const eventBuffer = Buffer.from(encryptedEvent).toString("binary");

    const dlqMessageId = await redis.xadd(
      dlqStreamKey,
      "*",
      "originalMessageId",
      "123-0",
      "originalStream",
      streamKey,
      "event",
      eventBuffer,
      "error",
      "Test error",
      "deliveryCount",
      "4",
      "timestamp",
      new Date().toISOString()
    );
    if (!dlqMessageId) {
      throw new Error("Failed to add message to DLQ");
    }

    // Verify DLQ message exists
    const dlqCountBefore = await consumer.getDLQCount(streamKey);
    expect(dlqCountBefore).toBe(1);

    // ACT
    const success = await consumer.reprocessDLQMessage(streamKey, dlqMessageId);

    // ASSERT
    expect(success).toBe(true);
    expect(processedEvents).toHaveLength(1);
    expect(processedEvents[0].aggregateId).toBe(aggregateId);

    // DLQ message should be removed
    const dlqCountAfter = await consumer.getDLQCount(streamKey);
    expect(dlqCountAfter).toBe(0);
  });

  test("reprocessing DLQ message fails if handler throws", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;
    const dlqStreamKey = `${streamKey}:dlq`;

    const eventHandler = {
      handle: async () => {
        throw new Error("Handler fails");
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // Manually add a message to DLQ
    const event = createTestEvent(aggregateId);
    const encryptedEvent = await encryptEvent(event);
    const eventBuffer = Buffer.from(encryptedEvent).toString("binary");

    const dlqMessageId = await redis.xadd(
      dlqStreamKey,
      "*",
      "originalMessageId",
      "123-0",
      "originalStream",
      streamKey,
      "event",
      eventBuffer,
      "error",
      "Test error",
      "deliveryCount",
      "4"
    );
    if (!dlqMessageId) {
      throw new Error("Failed to add message to DLQ");
    }

    // ACT
    const success = await consumer.reprocessDLQMessage(streamKey, dlqMessageId);

    // ASSERT
    expect(success).toBe(false);

    // DLQ message should still exist
    const dlqCount = await consumer.getDLQCount(streamKey);
    expect(dlqCount).toBe(1);
  });

  test("deletes DLQ message successfully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;
    const dlqStreamKey = `${streamKey}:dlq`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // Add a message to DLQ
    const event = createTestEvent(aggregateId);
    const encryptedEvent = await encryptEvent(event);
    const eventBuffer = Buffer.from(encryptedEvent).toString("binary");

    const dlqMessageId = await redis.xadd(
      dlqStreamKey,
      "*",
      "event",
      eventBuffer
    );
    if (!dlqMessageId) {
      throw new Error("Failed to add message to DLQ");
    }

    // Verify DLQ message exists
    const dlqCountBefore = await consumer.getDLQCount(streamKey);
    expect(dlqCountBefore).toBe(1);

    // ACT
    const deleted = await consumer.deleteDLQMessage(streamKey, dlqMessageId);

    // ASSERT
    expect(deleted).toBe(true);
    const dlqCountAfter = await consumer.getDLQCount(streamKey);
    expect(dlqCountAfter).toBe(0);
  });

  test("clears all DLQ messages successfully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;
    const dlqStreamKey = `${streamKey}:dlq`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // Add multiple messages to DLQ
    const event1 = createTestEvent(randomUUIDv7());
    const event2 = createTestEvent(randomUUIDv7());
    const encryptedEvent1 = await encryptEvent(event1);
    const encryptedEvent2 = await encryptEvent(event2);

    await redis.xadd(
      dlqStreamKey,
      "*",
      "event",
      Buffer.from(encryptedEvent1).toString("binary")
    );
    await redis.xadd(
      dlqStreamKey,
      "*",
      "event",
      Buffer.from(encryptedEvent2).toString("binary")
    );

    // Verify DLQ has messages
    const dlqCountBefore = await consumer.getDLQCount(streamKey);
    expect(dlqCountBefore).toBe(2);

    // ACT
    const cleared = await consumer.clearDLQ(streamKey);

    // ASSERT
    expect(cleared).toBe(true);
    const dlqCountAfter = await consumer.getDLQCount(streamKey);
    expect(dlqCountAfter).toBe(0);
  });

  test("gets all DLQ counts for multiple streams", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const todayStream = `events:${aggregateType}:${todayStr}`;
    const yesterdayStream = `events:${aggregateType}:${yesterdayStr}`;

    const todayDLQ = `${todayStream}:dlq`;
    const yesterdayDLQ = `${yesterdayStream}:dlq`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 2,
    });

    // Add messages to both DLQs
    const event1 = createTestEvent(randomUUIDv7());
    const event2 = createTestEvent(randomUUIDv7());
    const encryptedEvent1 = await encryptEvent(event1);
    const encryptedEvent2 = await encryptEvent(event2);

    await redis.xadd(
      todayDLQ,
      "*",
      "event",
      Buffer.from(encryptedEvent1).toString("binary")
    );
    await redis.xadd(
      yesterdayDLQ,
      "*",
      "event",
      Buffer.from(encryptedEvent2).toString("binary")
    );

    // ACT
    const allDLQCounts = await consumer.getAllDLQCounts();

    // ASSERT
    expect(allDLQCounts.size).toBeGreaterThanOrEqual(2);
    expect(allDLQCounts.get(todayStream)).toBe(1);
    expect(allDLQCounts.get(yesterdayStream)).toBe(1);
  });

  test("reads DLQ messages with correct metadata", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;
    const dlqStreamKey = `${streamKey}:dlq`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // Add message to DLQ with metadata
    const event = createTestEvent(aggregateId);
    const encryptedEvent = await encryptEvent(event);
    const eventBuffer = Buffer.from(encryptedEvent).toString("binary");

    const originalMessageId = "123-0";
    const errorMessage = "Test error message";
    const deliveryCount = "5";
    const timestamp = new Date().toISOString();

    await redis.xadd(
      dlqStreamKey,
      "*",
      "originalMessageId",
      originalMessageId,
      "originalStream",
      streamKey,
      "event",
      eventBuffer,
      "error",
      errorMessage,
      "deliveryCount",
      deliveryCount,
      "timestamp",
      timestamp,
      "consumerGroup",
      consumerGroupName,
      "consumer",
      consumerName
    );

    // ACT
    const dlqMessages = await consumer.readDLQMessages(streamKey, 10);

    // ASSERT
    expect(dlqMessages).toHaveLength(1);
    const message = dlqMessages[0];
    expect(message.originalMessageId).toBe(originalMessageId);
    expect(message.originalStream).toBe(streamKey);
    expect(message.error).toBe(errorMessage);
    expect(message.deliveryCount).toBe(deliveryCount);
    expect(message.timestamp).toBe(timestamp);
    expect(message.consumerGroup).toBe(consumerGroupName);
    expect(message.consumer).toBe(consumerName);
    expect(message.event.aggregateId).toBe(aggregateId);
  });

  test("throws error when starting consumer that is already running", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // Start consumer
    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT & ASSERT
    await expect(consumer.start()).rejects.toThrow(
      "Consumer is already running"
    );

    // Cleanup
    await consumer.stop();
  });

  test("stops consuming when stop is called", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries: 3,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Add an event
    const event1 = createTestEvent(aggregateId, "Event1");
    await addEventToStream(streamKey, event1);

    await waitFor(async () => processedEvents.length > 0, 10000);
    expect(processedEvents).toHaveLength(1);

    // ACT - stop consumer
    await consumer.stop();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const countBefore = processedEvents.length;

    // Add another event after stopping
    const event2 = createTestEvent(aggregateId, "Event2");
    await addEventToStream(streamKey, event2);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ASSERT - new event should not be processed
    expect(processedEvents.length).toBe(countBefore);
  }, 15000);

  test("gets consumer info successfully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT
    const consumerInfo = await consumer.getConsumerInfo(streamKey);

    // ASSERT
    expect(consumerInfo).not.toBeNull();
    expect(Array.isArray(consumerInfo)).toBe(true);

    // Cleanup
    await consumer.stop();
  }, 15000);

  test("gets pending count successfully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    // Create consumer group and add message
    await redis.xgroup("CREATE", streamKey, consumerGroupName, "0", "MKSTREAM");
    const event = createTestEvent(aggregateId);
    await addEventToStream(streamKey, event);

    // Read message but don't acknowledge it
    await redis.xreadgroup(
      "GROUP",
      consumerGroupName,
      consumerName,
      "STREAMS",
      streamKey,
      ">"
    );

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // ACT
    const pendingCount = await consumer.getPendingCount(streamKey);

    // ASSERT
    expect(pendingCount).toBe(1);
  });

  test("handles parse errors in messages gracefully", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const aggregateId = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries: 3,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Add an invalid message (not encrypted properly)
    await redis.xadd(streamKey, "*", "event", "invalid-data");

    // Add a valid message
    await new Promise((resolve) => setTimeout(resolve, 500));
    const validEvent = createTestEvent(aggregateId);
    await addEventToStream(streamKey, validEvent);

    // Wait for valid message to be processed
    await waitFor(async () => processedEvents.length > 0, 3000);

    // ASSERT - consumer should continue working despite parse error
    expect(processedEvents.length).toBeGreaterThanOrEqual(1);
    expect(processedEvents[0].aggregateId).toBe(aggregateId);

    // Cleanup
    await consumer.stop();
  });

  test("processes multiple aggregate types", async () => {
    // ARRANGE
    const aggregateType1 = `test-aggregate-1-${randomUUIDv7()}`;
    const aggregateType2 = `test-aggregate-2-${randomUUIDv7()}`;
    const aggregateId1 = randomUUIDv7();
    const aggregateId2 = randomUUIDv7();
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey1 = `events:${aggregateType1}:${dateStr}`;
    const streamKey2 = `events:${aggregateType2}:${dateStr}`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType1, aggregateType2],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
      maxRetries: 3,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // ACT - add events to both aggregate types
    const event1 = createTestEvent(aggregateId1, "Type1Event");
    const event2 = createTestEvent(aggregateId2, "Type2Event");
    await addEventToStream(streamKey1, event1);
    await addEventToStream(streamKey2, event2);

    // Wait for both messages to be processed
    await waitFor(async () => processedEvents.length >= 2, 5000);

    // ASSERT
    expect(processedEvents.length).toBeGreaterThanOrEqual(2);
    const eventNames = processedEvents.map((e) => e.eventName);
    expect(eventNames).toContain("Type1Event");
    expect(eventNames).toContain("Type2Event");

    // Cleanup
    await consumer.stop();
  });

  test("handles missing event field in stream message", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const processedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    const eventHandler = {
      handle: async (event: DomainEvent<string, Record<string, unknown>>) => {
        processedEvents.push(event);
      },
    };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      batchSize: 10,
      blockTimeMs: 100,
      partitionDays: 1,
    });

    const consumerPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Add a message without the 'event' field
    await redis.xadd(streamKey, "*", "other_field", "some_value");

    // Wait a bit to ensure consumer tries to process it
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ASSERT - should not crash and should not process invalid message
    expect(processedEvents).toHaveLength(0);

    // Cleanup
    await consumer.stop();
  });

  test("reprocessing non-existent DLQ message returns false", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // ACT - try to reprocess a non-existent message
    const success = await consumer.reprocessDLQMessage(
      streamKey,
      "non-existent-id"
    );

    // ASSERT
    expect(success).toBe(false);
  });

  test("deleting non-existent DLQ message returns false", async () => {
    // ARRANGE
    const aggregateType = `test-aggregate-${randomUUIDv7()}`;
    const consumerGroupName = `test-group-${randomUUIDv7()}`;
    const consumerName = `test-consumer-${randomUUIDv7()}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const streamKey = `events:${aggregateType}:${dateStr}`;

    const eventHandler = { handle: async () => {} };

    const consumer = new RedisAggregateTypeConsumer({
      aggregateTypes: [aggregateType],
      eventHandler,
      consumerGroupName,
      consumerName,
      partitionDays: 1,
    });

    // ACT
    const deleted = await consumer.deleteDLQMessage(
      streamKey,
      "non-existent-id"
    );

    // ASSERT
    expect(deleted).toBe(false);
  });
});
