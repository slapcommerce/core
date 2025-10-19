import { OutboxDispatcher } from "../../../src/infrastructure/outboxDispatcher";
import { expect, test, describe } from "bun:test";
import { db } from "../../helpers/postgres";
import { redis, redisStreamsResponseToObject } from "../../helpers/redis";
import {
  insertPendingOutboxMessage,
  insertPendingOutboxMessageWithEvent,
  insertDispatchedOutboxMessage,
  insertProcessedOutboxMessage,
  createMockIntegrationEvent,
} from "../../helpers/factories";
import { randomUUIDv7 } from "bun";
import { OutboxTable } from "../../../src/infrastructure/orm";
import { eq } from "drizzle-orm";

describe("OutboxDispatcher", () => {
  test("dispatches pending outbox message to Redis and updates status", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    await insertPendingOutboxMessage(db, outboxId, streamName);
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
    });

    // ACT
    await dispatcher.dispatch(outboxId);

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(1);
    const messageData = redisStreamsResponseToObject(streamMessages[0]);
    expect(messageData.outbox_id).toBe(outboxId);
  });

  test("dispatches event payload correctly to Redis stream", async () => {
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
    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId,
      mockEvent,
      streamName
    );
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
    });

    // ACT
    await dispatcher.dispatch(outboxId);

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(1);
    const messageData = redisStreamsResponseToObject(streamMessages[0]);
    expect(messageData.outbox_id).toBe(outboxId);
    expect(messageData.type).toBe("ProductCreated");
    const payload = JSON.parse(messageData.payload);
    expect(payload.eventId).toBe(eventId);
    expect(payload.eventName).toBe("ProductCreated");
    expect(payload.correlationId).toBe(correlationId);
    expect(payload.payload.title).toBe("Test Product");
  });

  test("updates outbox status to dispatched and increments attempts", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    await insertPendingOutboxMessage(db, outboxId, streamName);
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
    });

    // ACT
    await dispatcher.dispatch(outboxId);

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

  test("does not re-dispatch already dispatched message", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      eventId,
      correlationId
    );
    await insertDispatchedOutboxMessage(db, outboxId, 1, mockEvent, streamName);
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
    });

    // ACT
    await dispatcher.dispatch(outboxId);

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

  test("does not re-dispatch already processed message", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      eventId,
      correlationId
    );
    await insertProcessedOutboxMessage(db, outboxId, 2, mockEvent, streamName);
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
    });

    // ACT
    await dispatcher.dispatch(outboxId);

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(0);
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.attempts).toBe(2); // Should not increment
  });

  test("handles non-existent outbox message gracefully", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7(); // Non-existent ID
    const streamName = randomUUIDv7();
    const dispatcher = new OutboxDispatcher({
      db,
      redis,
    });

    // ACT
    await dispatcher.dispatch(outboxId); // Should not throw

    // ASSERT
    const streamMessages = await redis.xrange(streamName, "-", "+");
    expect(streamMessages).toHaveLength(0);
  });

  test("handles errors gracefully without throwing", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const invalidRedis = {
      xadd: async () => {
        throw new Error("Redis connection failed");
      },
    } as any;
    await insertPendingOutboxMessage(db, outboxId, streamName);
    const dispatcher = new OutboxDispatcher({
      db,
      redis: invalidRedis,
    });

    // ACT & ASSERT - should not throw
    await dispatcher.dispatch(outboxId);

    // Verify message remains in pending status since dispatch failed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("pending");
  });
});
