import { RedisStreamConsumer } from "../../../src/infrastructure/redisStreamConsumer";
import { expect, test, describe } from "bun:test";
import { db } from "../../helpers/postgres";
import { redis, redisStreamsResponseToObject } from "../../helpers/redis";
import {
  insertPendingOutboxMessage,
  insertDispatchedOutboxMessage,
  insertProcessedOutboxMessage,
  createMockIntegrationEvent,
  insertPendingOutboxMessageWithEvent,
  insertDispatchedOutboxMessageWithEvent,
} from "../../helpers/factories";
import {
  FakeProjectionHandler,
  FakeExternalEffectHandler,
} from "../../helpers/fakes/projectionHandlers";
import { randomUUIDv7 } from "bun";
import {
  OutboxTable,
  UnprocessableMessagesDeadLetterQueueTable,
} from "../../../src/infrastructure/orm";
import { eq } from "drizzle-orm";

describe("RedisStreamConsumer", () => {
  // HAPPY PATH: Successfully consume and process a message

  test("consumes message from Redis stream, processes it, marks as processed, and ACKs", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Test Product" },
      eventId,
      correlationId
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      1,
      mockEvent,
      streamName
    );

    // Add message to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    // Give consumer time to process the message
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Verify handlers were called
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);

    // Verify outbox message is marked as processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
    expect(outboxMessage.processedAt).not.toBeNull();

    // Verify message was ACKed (not in pending entries list)
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0); // No pending messages
  });

  test("processes multiple messages in batch", async () => {
    // ARRANGE
    const outboxId1 = randomUUIDv7();
    const outboxId2 = randomUUIDv7();
    const outboxId3 = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    const mockEvent1 = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const mockEvent2 = createMockIntegrationEvent(
      "ProductUpdated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const mockEvent3 = createMockIntegrationEvent(
      "ProductArchived",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId1,
      1,
      mockEvent1,
      streamName
    );
    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId2,
      1,
      mockEvent2,
      streamName
    );
    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId3,
      1,
      mockEvent3,
      streamName
    );

    // Add messages to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId1,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent1)
    );
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId2,
      "type",
      "ProductUpdated",
      "payload",
      JSON.stringify(mockEvent2)
    );
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId3,
      "type",
      "ProductArchived",
      "payload",
      JSON.stringify(mockEvent3)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    // Give consumer time to process all messages
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    expect(projectionHandler.callCount).toBe(3);
    expect(externalEffectHandler.callCount).toBe(3);

    // Verify all messages are marked as processed
    const [outboxMessage1] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId1))
      .execute();
    const [outboxMessage2] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId2))
      .execute();
    const [outboxMessage3] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId3))
      .execute();

    expect(outboxMessage1.status).toBe("processed");
    expect(outboxMessage2.status).toBe("processed");
    expect(outboxMessage3.status).toBe("processed");
  });

  // OTHER CODE PATHS: Idempotency

  test("skips already processed message and ACKs it", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertProcessedOutboxMessage(db, outboxId, 2, mockEvent, streamName);

    // Add message to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should not be called for already processed message
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);

    // Message should be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);

    // Verify attempts was not incremented
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.attempts).toBe(2); // Should remain 2
  });

  // OTHER CODE PATHS: Missing outbox message

  test("handles missing outbox message gracefully and ACKs it", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7(); // Non-existent outbox ID
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    // Add message to Redis stream (but no outbox record) (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should not be called
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);

    // Message should be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // OTHER CODE PATHS: Malformed messages

  test("handles malformed message with missing outbox_id and ACKs it", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    // Add message without outbox_id (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should not be called
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);

    // Message should be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  test("handles malformed message with missing payload and ACKs it", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    // Add message without payload (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated"
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should not be called
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);

    // Message should be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // OTHER CODE PATHS: Max attempts exceeded

  test("moves message to DLQ when max attempts exceeded and ACKs it", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const maxAttempts = 3;
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Test Product" },
      randomUUIDv7(),
      randomUUIDv7()
    );

    // Create outbox message with attempts = maxAttempts
    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      maxAttempts,
      mockEvent,
      streamName
    );

    // Add message to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should not be called
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);

    // Message should be in DLQ
    const [dlqMessage] = await db
      .select()
      .from(UnprocessableMessagesDeadLetterQueueTable)
      .where(eq(UnprocessableMessagesDeadLetterQueueTable.id, outboxId))
      .execute();
    expect(dlqMessage).toBeDefined();
    expect(dlqMessage.lastError).toContain("Exceeded max attempts");

    // Message should be removed from outbox
    const outboxMessages = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessages).toHaveLength(0);

    // Message should be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // OTHER CODE PATHS: Processing failures

  test("does not ACK message when projection handler fails", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      1,
      mockEvent,
      streamName
    );

    // Add message to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    projectionHandler.setFailure(true, "Database connection failed");
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should be called
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);

    // Message should not be marked as processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched"); // Should remain dispatched
    expect(outboxMessage.processedAt).toBeNull();

    // Message should not be ACKed (stays in pending list for retry)
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(1); // One pending message
  });

  test("does not ACK message when external effect handler fails", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      1,
      mockEvent,
      streamName
    );

    // Add message to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();
    externalEffectHandler.setFailure(true, "Stripe API failed");

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should be called
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);

    // Message should not be marked as processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched");
    expect(outboxMessage.processedAt).toBeNull();

    // Message should not be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(1);
  });

  test("does not ACK message when both handlers fail", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      1,
      mockEvent,
      streamName
    );

    // Add message to Redis stream (use partitioned stream name)
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    projectionHandler.setFailure(true, "Database failed");
    const externalEffectHandler = new FakeExternalEffectHandler();
    externalEffectHandler.setFailure(true, "Stripe failed");

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Handlers should be called
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);

    // Message should not be marked as processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched");

    // Message should not be ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(1);
  });

  // EDGE CASES: Consumer group creation

  test("creates consumer group if it does not exist", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await consumer.shutdown();
    await startPromise;

    // ASSERT - Group should be created (check the partitioned stream)
    const groups = (await redis.xinfo(
      "GROUPS",
      partitionedStreamName
    )) as any[];
    const groupExists = groups.some((group: any) => {
      // groups is array of arrays: [[name, groupName, ...], ...]
      const nameIndex = group.indexOf("name");
      return nameIndex !== -1 && group[nameIndex + 1] === groupName;
    });
    expect(groupExists).toBe(true);
  });

  test("handles existing consumer group gracefully", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    // Create stream and group manually (use partitioned stream name)
    await redis.xadd(partitionedStreamName, "*", "test", "data");
    await redis.xgroup("CREATE", partitionedStreamName, groupName, "0");

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT - Should not throw even though group exists
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await consumer.shutdown();
    await startPromise;

    // ASSERT - Should complete without error
    const groups = (await redis.xinfo(
      "GROUPS",
      partitionedStreamName
    )) as any[];
    expect(groups.length).toBeGreaterThan(0);
  });

  // EDGE CASES: Shutdown behavior

  test("completes in-flight operations before shutdown", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      1,
      mockEvent,
      streamName
    );

    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    // Request shutdown almost immediately
    await new Promise((resolve) => setTimeout(resolve, 100));
    await consumer.shutdown();
    await startPromise;

    // ASSERT - Message should still be processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
  });

  test("stops consuming new messages after shutdown", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await consumer.shutdown();
    await startPromise;

    // Add message after shutdown
    const outboxId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId,
      1,
      mockEvent,
      streamName
    );
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent)
    );

    // Give time for consumer to potentially process (it shouldn't)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // ASSERT - Message should not be processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched");
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);
  });

  // EDGE CASES: No messages available

  test("handles no messages gracefully", async () => {
    // ARRANGE
    const streamName = randomUUIDv7();
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait longer than blockMs
    await consumer.shutdown();
    await startPromise;

    // ASSERT - Should not throw, handlers should not be called
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);
  });

  // EDGE CASES: Continues processing after handler exception

  test("continues processing other messages when one message throws exception", async () => {
    // ARRANGE
    const outboxId1 = randomUUIDv7();
    const outboxId2 = randomUUIDv7();
    const streamName = randomUUIDv7();
    const partitionedStreamName = `${streamName}:0`; // Consumer reads from partitioned streams
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    const mockEvent1 = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const mockEvent2 = createMockIntegrationEvent(
      "ProductUpdated",
      { productId: randomUUIDv7() },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId1,
      1,
      mockEvent1,
      streamName
    );
    await insertDispatchedOutboxMessageWithEvent(
      db,
      outboxId2,
      1,
      mockEvent2,
      streamName
    );

    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId1,
      "type",
      "ProductCreated",
      "payload",
      JSON.stringify(mockEvent1)
    );
    await redis.xadd(
      partitionedStreamName,
      "*",
      "outbox_id",
      outboxId2,
      "type",
      "ProductUpdated",
      "payload",
      JSON.stringify(mockEvent2)
    );

    let callCount = 0;
    const projectionHandler = {
      async handleIntegrationEvent() {
        callCount++;
        if (callCount === 1) {
          throw new Error("Unexpected exception");
        }
        return { success: true };
      },
    };
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Second message should still be processed
    const [outboxMessage2] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId2))
      .execute();
    expect(outboxMessage2.status).toBe("processed");

    // First message should not be processed (exception)
    const [outboxMessage1] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId1))
      .execute();
    expect(outboxMessage1.status).toBe("dispatched");
  });
});
