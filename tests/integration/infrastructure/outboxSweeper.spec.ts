import { OutboxSweeper } from "../../../src/infrastructure/outboxSweeper";
import { expect, test, describe } from "bun:test";
import { db } from "../../helpers/postgres";
import { redis, redisStreamsResponseToObject } from "../../helpers/redis";
import {
  insertPendingOutboxMessage,
  insertPendingOutboxMessageWithEvent,
  insertDispatchedOutboxMessage,
  createMockIntegrationEvent,
  insertStuckPendingOutboxMessage,
  insertStuckDispatchedOutboxMessage,
  insertStuckOutboxMessageWithMaxAttempts,
} from "../../helpers/factories";
import { randomUUIDv7 } from "bun";
import {
  OutboxTable,
  UndeliverableMessagesDeadLetterQueueTable,
} from "../../../src/infrastructure/orm";
import { eq } from "drizzle-orm";

describe("OutboxSweeper", () => {
  // HAPPY PATH: Republishing stuck pending messages

  test("sweeps stuck pending message and republishes to Redis", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Test Product" },
      eventId,
      correlationId
    );
    // Create a pending message that's older than threshold (61 seconds ago)
    await insertStuckPendingOutboxMessage(db, outboxId, 61000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
    const ourMessage = streamMessages.find((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessage).toBeDefined();
    const messageData = redisStreamsResponseToObject(ourMessage!);
    expect(messageData.outbox_id).toBe(outboxId);
    expect(messageData.type).toBe("ProductCreated");
    const payload = JSON.parse(messageData.payload);
    expect(payload.eventId).toBe(eventId);
    expect(payload.correlationId).toBe(correlationId);
  });

  test("updates stuck pending message status to dispatched and increments attempts", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckPendingOutboxMessage(db, outboxId, 61000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched");
    expect(outboxMessage.attempts).toBe(1);
    expect(outboxMessage.dispatchedAt).not.toBeNull();
  });

  // HAPPY PATH: Republishing stuck dispatched messages

  test("sweeps stuck dispatched message and republishes to Redis", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Test Product" },
      eventId,
      correlationId
    );
    // Create a dispatched message that's older than threshold (61 seconds ago)
    await insertStuckDispatchedOutboxMessage(db, outboxId, 61000, 1, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(1);
    const messageData = redisStreamsResponseToObject(streamMessages[0]);
    expect(messageData.outbox_id).toBe(outboxId);
    expect(messageData.type).toBe("ProductCreated");
  });

  test("increments attempts when republishing stuck dispatched message", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckDispatchedOutboxMessage(db, outboxId, 61000, 3, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched");
    expect(outboxMessage.attempts).toBe(4); // Incremented from 3 to 4
    expect(outboxMessage.dispatchedAt).not.toBeNull();
  });

  // OTHER CODE PATHS: Threshold checks

  test("does not sweep pending message that is too recent", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    // Create a pending message that's only 30 seconds old (within threshold)
    await insertStuckPendingOutboxMessage(db, outboxId, 30000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(0);
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("pending");
    expect(outboxMessage.attempts).toBe(0); // Should not increment
  });

  test("does not sweep dispatched message that is too recent", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    // Create a dispatched message that's only 30 seconds old (within threshold)
    await insertStuckDispatchedOutboxMessage(db, outboxId, 30000, 1, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(0);
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.attempts).toBe(1); // Should not increment
  });

  // OTHER CODE PATHS: Multiple messages in one sweep

  test("sweeps multiple stuck messages in one sweep cycle", async () => {
    // ARRANGE
    const outboxId1 = randomUUIDv7();
    const outboxId2 = randomUUIDv7();
    const outboxId3 = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckPendingOutboxMessage(db, outboxId1, 61000, mockEvent);
    await insertStuckDispatchedOutboxMessage(
      db,
      outboxId2,
      61000,
      1,
      mockEvent
    );
    await insertStuckPendingOutboxMessage(db, outboxId3, 61000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(3);
  });

  // OTHER CODE PATHS: Max attempts exceeded

  test("moves message to undeliverable queue after 10 attempts", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Test Product" },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckOutboxMessageWithMaxAttempts(
      db,
      outboxId,
      61000,
      10,
      mockEvent
    );
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    // Message should be in undeliverable queue
    const [undeliverableMessage] = await db
      .select()
      .from(UndeliverableMessagesDeadLetterQueueTable)
      .where(eq(UndeliverableMessagesDeadLetterQueueTable.id, outboxId))
      .execute();
    expect(undeliverableMessage).toBeDefined();
    expect(undeliverableMessage.attempts).toBe(10);
    expect(undeliverableMessage.lastError).toBe("Max attempts exceeded (10)");

    // Message should be removed from outbox
    const outboxMessages = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessages).toHaveLength(0);

    // Should not be published to Redis
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(0);
  });

  test("does not move message to undeliverable queue if below 10 attempts", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckDispatchedOutboxMessage(db, outboxId, 61000, 9, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    // Message should be republished
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(1);

    // Message should still be in outbox
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage).toBeDefined();
    expect(outboxMessage.attempts).toBe(10); // Incremented from 9 to 10

    // Should not be in undeliverable queue yet
    const undeliverableMessages = await db
      .select()
      .from(UndeliverableMessagesDeadLetterQueueTable)
      .where(eq(UndeliverableMessagesDeadLetterQueueTable.id, outboxId))
      .execute();
    expect(undeliverableMessages).toHaveLength(0);
  });

  // EDGE CASES: No stuck messages

  test("handles sweep when no stuck messages found", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT - Should not throw
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(0);
  });

  // EDGE CASES: Start/shutdown behavior

  test("does not start sweep if already running", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.start(); // Second start should be ignored

    // ASSERT - Should not throw, sweep should only run once
    await sweeper.shutdown();
  });

  test("shutdown stops the sweeper gracefully", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckPendingOutboxMessage(db, outboxId, 61000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 60,
      sweepIntervalMs: 100, // Fast interval for testing
    });

    // ACT
    await sweeper.start();
    // Give it time to complete first sweep
    await new Promise((resolve) => setTimeout(resolve, 50));
    await sweeper.shutdown();

    // ASSERT - Should complete gracefully
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
  });

  // EDGE CASES: Error handling

  test("continues processing other messages when one message fails", async () => {
    // ARRANGE
    const outboxId1 = randomUUIDv7();
    const outboxId2 = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckPendingOutboxMessage(db, outboxId1, 61000, mockEvent);
    await insertStuckPendingOutboxMessage(db, outboxId2, 61000, mockEvent);

    // Create a sweeper with a Redis client that fails on first xadd
    let addCount = 0;
    const flakyRedis = {
      xadd: async (
        key: string,
        id: string,
        ...fieldValues: string[]
      ): Promise<string | null> => {
        addCount++;
        if (addCount === 1) {
          throw new Error("Redis connection failed");
        }
        return redis.xadd(key, id, ...fieldValues);
      },
    } as any;

    const sweeper = new OutboxSweeper({
      db,
      redis: flakyRedis,
      streamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT - Second message should still be processed despite first one failing
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
  });

  // EDGE CASES: Custom configuration

  test("uses custom threshold seconds for sweep criteria", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    // Create a message that's 15 seconds old
    await insertStuckPendingOutboxMessage(db, outboxId, 15000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName,
      thresholdSeconds: 10, // 10 second threshold, so 15 second old message should be swept
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
    const ourMessage = streamMessages.find((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessage).toBeDefined();
  });

  test("uses custom stream name for publishing events", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const customStreamName = "custom-events-stream-" + randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertStuckPendingOutboxMessage(db, outboxId, 61000, mockEvent);
    const sweeper = new OutboxSweeper({
      db,
      redis,
      streamName: customStreamName,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    const streamMessages = await redis.xrange(customStreamName, "-", "+");
    expect(streamMessages).toHaveLength(1);
    const messageData = redisStreamsResponseToObject(streamMessages[0]);
    expect(messageData.outbox_id).toBe(outboxId);
  });
});
