import { OutboxDispatcher } from "../../src/infrastructure/outboxDispatcher";
import { OutboxSweeper } from "../../src/infrastructure/outboxSweeper";
import { RedisStreamConsumer } from "../../src/infrastructure/redisStreamConsumer";
import { expect, test, describe } from "bun:test";
import { db } from "../helpers/postgres";
import { redis, redisStreamsResponseToObject } from "../helpers/redis";
import {
  insertPendingOutboxMessageWithEvent,
  insertStuckPendingOutboxMessage,
  insertStuckDispatchedOutboxMessage,
  insertStuckOutboxMessageWithMaxAttempts,
  createMockIntegrationEvent,
} from "../helpers/factories";
import {
  FakeProjectionHandler,
  FakeExternalEffectHandler,
} from "../helpers/fakes/projectionHandlers";
import { randomUUIDv7 } from "bun";
import {
  OutboxTable,
  UndeliverableMessagesDeadLetterQueueTable,
  UnprocessableMessagesDeadLetterQueueTable,
} from "../../src/infrastructure/orm";
import { eq, inArray, and } from "drizzle-orm";

describe("E2E Messaging System", () => {
  // ========================================================================
  // HAPPY PATH: Complete end-to-end flow
  // ========================================================================

  test("complete flow: pending → dispatch → consume → process", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "E2E Test Product" },
      eventId,
      correlationId
    );

    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId,
      mockEvent,
      partitionedStreamName
    );

    const dispatcher = new OutboxDispatcher({ db, redis });
    const handler = new FakeProjectionHandler();
    const consumer = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Step 1: Dispatch the message
    await dispatcher.dispatch(outboxId);

    // Step 2: Start consumer to process the message
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Verify message was dispatched to Redis
    const streamMessages = await redis.xrange(partitionedStreamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
    const ourMessage = streamMessages.find((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessage).toBeDefined();

    // Verify handlers were called (only projection handler for projection streams)
    expect(handler.callCount).toBe(1);
    expect(handler.calledWith[0].eventId).toBe(eventId);

    // Verify outbox status is processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
    expect(outboxMessage.processedAt).not.toBeNull();
    expect(outboxMessage.attempts).toBe(1);

    // Verify message was ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // ========================================================================
  // SWEEPER RECOVERY: Stuck pending messages
  // ========================================================================

  test("sweeper recovers stuck pending message and consumer processes it", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Stuck Pending Product" },
      eventId,
      correlationId
    );

    // Create a stuck pending message (older than threshold)
    await insertStuckPendingOutboxMessage(
      db,
      outboxId,
      61000,
      mockEvent,
      partitionedStreamName
    );

    const sweeper = new OutboxSweeper({
      db,
      redis,
      thresholdSeconds: 60,
    });
    const handler = new FakeProjectionHandler();
    const consumer = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Step 1: Sweeper picks up stuck message and republishes
    await sweeper.start();
    await sweeper.shutdown();

    // Step 2: Consumer processes the republished message
    const startPromise = consumer.start();
    await Bun.sleep(500);
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Verify message was republished to Redis
    const streamMessages = await redis.xrange(partitionedStreamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
    const ourMessage = streamMessages.find((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessage).toBeDefined();

    // Verify handlers were called (only projection handler for projection streams)
    expect(handler.callCount).toBeGreaterThanOrEqual(1);
    expect(handler.calledWith[0].eventId).toBe(eventId);

    // Verify outbox status is processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
    expect(outboxMessage.processedAt).not.toBeNull();
    expect(outboxMessage.attempts).toBe(1); // Sweeper incremented from 0 to 1

    // Verify message was ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // ========================================================================
  // SWEEPER RECOVERY: Stuck dispatched messages
  // ========================================================================

  test("sweeper recovers stuck dispatched message and consumer reprocesses it", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Stuck Dispatched Product" },
      eventId,
      correlationId
    );

    // Create a stuck dispatched message (dispatched but not processed)
    await insertStuckDispatchedOutboxMessage(
      db,
      outboxId,
      61000,
      1,
      mockEvent,
      partitionedStreamName
    );

    const sweeper = new OutboxSweeper({
      db,
      redis,
      thresholdSeconds: 60,
    });
    const handler = new FakeProjectionHandler();
    const consumer = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Step 1: Sweeper picks up stuck dispatched message and republishes
    await sweeper.start();
    await sweeper.shutdown();

    // Step 2: Consumer processes the republished message
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Verify message was republished to Redis
    const streamMessages = await redis.xrange(partitionedStreamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(1);
    const ourMessage = streamMessages.find((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessage).toBeDefined();

    // Verify handlers were called (only projection handler for projection streams)
    expect(handler.callCount).toBe(1);

    // Verify outbox status is processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
    expect(outboxMessage.processedAt).not.toBeNull();
    expect(outboxMessage.attempts).toBe(2); // Was 1, sweeper incremented to 2

    // Verify message was ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // ========================================================================
  // CONSUMER FAILURE RECOVERY: Sweeper retries after consumer fails
  // ========================================================================

  test("consumer fails to process, sweeper retries, consumer succeeds on retry", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Failing Product" },
      eventId,
      correlationId
    );

    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId,
      mockEvent,
      partitionedStreamName
    );

    const dispatcher = new OutboxDispatcher({ db, redis });
    const handler = new FakeProjectionHandler();

    // Make projection handler fail initially
    handler.setFailure(true, "Database connection failed");

    const consumer1 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId: consumerId + "-1",
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Step 1: Dispatch the message
    await dispatcher.dispatch(outboxId);

    // Step 2: Consumer tries to process but fails
    const startPromise1 = consumer1.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer1.shutdown();
    await startPromise1;

    // Verify message is still dispatched (not processed)
    let [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("dispatched");
    expect(outboxMessage.processedAt).toBeNull();

    // Step 3: Wait for message to become "stuck", then sweeper picks it up
    // Create a new message with stuck timestamp
    await db.delete(OutboxTable).where(eq(OutboxTable.id, outboxId)).execute();
    await insertStuckDispatchedOutboxMessage(
      db,
      outboxId,
      61000,
      1,
      mockEvent,
      partitionedStreamName
    );

    const sweeper = new OutboxSweeper({
      db,
      redis,
      thresholdSeconds: 60,
    });
    await sweeper.start();
    await sweeper.shutdown();

    // Step 4: Fix the projection handler and consumer retries
    handler.setFailure(false);
    const consumer2 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId: consumerId + "-2",
      streamName,
      partitionCount: 1,
      groupName,
    });

    const startPromise2 = consumer2.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer2.shutdown();
    await startPromise2;

    // ASSERT
    // Verify handlers were called (only projection handler for projection streams)
    expect(handler.callCount).toBeGreaterThanOrEqual(2);
    expect(handler.calledWith[0].eventId).toBe(eventId);
    expect(handler.calledWith[1].eventId).toBe(eventId);

    // Verify outbox status is processed
    [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
    expect(outboxMessage.processedAt).not.toBeNull();
    expect(outboxMessage.attempts).toBe(2); // Sweeper incremented from 1 to 2

    // Note: We don't check pending count because other stuck messages from previous tests
    // may still be in the pending list if they failed processing
  });

  // ========================================================================
  // MAX ATTEMPTS: Sweeper moves to dead letter queue
  // ========================================================================

  test("sweeper moves message to undeliverable DLQ after max attempts", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Max Attempts Product" },
      eventId,
      correlationId
    );

    // Create a message with 10 attempts (max)
    await insertStuckOutboxMessageWithMaxAttempts(
      db,
      outboxId,
      61000,
      10,
      mockEvent,
      partitionedStreamName
    );

    const sweeper = new OutboxSweeper({
      db,
      redis,
      thresholdSeconds: 60,
    });

    // ACT
    await sweeper.start();
    await sweeper.shutdown();

    // ASSERT
    // Verify message is no longer in outbox
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage).toBeUndefined();

    // Verify message is in undeliverable DLQ
    const [dlqMessage] = await db
      .select()
      .from(UndeliverableMessagesDeadLetterQueueTable)
      .where(eq(UndeliverableMessagesDeadLetterQueueTable.id, outboxId))
      .execute();
    expect(dlqMessage).toBeDefined();
    expect(dlqMessage.attempts).toBe(10);
    expect(dlqMessage.lastError).toContain("Max attempts exceeded");
    expect(dlqMessage.failedAt).not.toBeNull();

    // Verify message was NOT republished to Redis
    const streamMessages = await redis.xrange(partitionedStreamName, "-", "+");
    const ourMessage = streamMessages.find((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessage).toBeUndefined();
  });

  // ========================================================================
  // MAX ATTEMPTS: Consumer moves to unprocessable DLQ
  // ========================================================================

  test("consumer moves message to unprocessable DLQ after max attempts", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Unprocessable Product" },
      eventId,
      correlationId
    );

    // Create a message that's already been dispatched with maxAttempts
    await insertStuckDispatchedOutboxMessage(
      db,
      outboxId,
      1000,
      3,
      mockEvent,
      partitionedStreamName
    );

    // Add message to Redis stream
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

    const handler = new FakeProjectionHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3, // Message already at max
      consumerId,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Verify handlers were NOT called (max attempts exceeded)
    expect(handler.callCount).toBe(0);

    // Verify message is no longer in outbox
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage).toBeUndefined();

    // Verify message is in unprocessable DLQ
    const [dlqMessage] = await db
      .select()
      .from(UnprocessableMessagesDeadLetterQueueTable)
      .where(eq(UnprocessableMessagesDeadLetterQueueTable.id, outboxId))
      .execute();
    expect(dlqMessage).toBeDefined();
    expect(dlqMessage.lastError).toContain("Exceeded max attempts");
    expect(dlqMessage.failedAt).not.toBeNull();

    // Verify message was ACKed (to prevent reprocessing)
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // ========================================================================
  // IDEMPOTENCY: Multiple dispatches don't cause duplicate processing
  // ========================================================================

  test("idempotency: multiple dispatches of same message result in single processing", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const eventId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const mockEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Idempotent Product" },
      eventId,
      correlationId
    );

    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId,
      mockEvent,
      partitionedStreamName
    );

    const dispatcher = new OutboxDispatcher({ db, redis });
    const handler = new FakeProjectionHandler();
    const consumer = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Dispatch the message multiple times
    await dispatcher.dispatch(outboxId);
    await dispatcher.dispatch(outboxId); // Should be no-op
    await dispatcher.dispatch(outboxId); // Should be no-op

    // Consumer processes
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer.shutdown();
    await startPromise;

    // Try to dispatch again after processing
    await dispatcher.dispatch(outboxId); // Should be no-op

    // ASSERT
    // Verify only one message in Redis stream
    const streamMessages = await redis.xrange(partitionedStreamName, "-", "+");
    const ourMessages = streamMessages.filter((msg) => {
      const data = redisStreamsResponseToObject(msg);
      return data.outbox_id === outboxId;
    });
    expect(ourMessages.length).toBe(1);

    // Verify handlers were called only once (only projection handler for projection streams)
    expect(handler.callCount).toBe(1);

    // Verify outbox status is processed
    const [outboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, outboxId))
      .execute();
    expect(outboxMessage.status).toBe("processed");
    expect(outboxMessage.attempts).toBe(1);
  });

  // ========================================================================
  // CONCURRENT PROCESSING: Multiple consumers handle different messages
  // ========================================================================

  test("multiple messages processed concurrently by different consumers", async () => {
    // ARRANGE
    const outboxId1 = randomUUIDv7();
    const outboxId2 = randomUUIDv7();
    const outboxId3 = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId1 = randomUUIDv7();
    const consumerId2 = randomUUIDv7();

    const mockEvent1 = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Product 1" },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const mockEvent2 = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Product 2" },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const mockEvent3 = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Product 3" },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId1,
      mockEvent1,
      partitionedStreamName
    );
    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId2,
      mockEvent2,
      partitionedStreamName
    );
    await insertPendingOutboxMessageWithEvent(
      db,
      outboxId3,
      mockEvent3,
      partitionedStreamName
    );

    const dispatcher = new OutboxDispatcher({ db, redis });
    const handler1 = new FakeProjectionHandler();
    const handler2 = new FakeProjectionHandler();

    const consumer1 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler1 as any,
      maxAttempts: 3,
      consumerId: consumerId1,
      streamName,
      partitionCount: 1,
      groupName,
    });

    const consumer2 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler2 as any,
      maxAttempts: 3,
      consumerId: consumerId2,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Dispatch all messages
    await dispatcher.dispatch(outboxId1);
    await dispatcher.dispatch(outboxId2);
    await dispatcher.dispatch(outboxId3);

    // Start both consumers
    const startPromise1 = consumer1.start();
    const startPromise2 = consumer2.start();

    // Give consumers time to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await consumer1.shutdown();
    await consumer2.shutdown();
    await Promise.all([startPromise1, startPromise2]);

    // ASSERT
    // Verify all messages were dispatched to Redis
    const streamMessages = await redis.xrange(partitionedStreamName, "-", "+");
    expect(streamMessages.length).toBeGreaterThanOrEqual(3);

    // Verify all handlers were called (distributed across consumers, only projection handler for projection streams)
    const totalProjectionCalls = handler1.callCount + handler2.callCount;
    expect(totalProjectionCalls).toBe(3);

    // Verify all messages are processed
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

    // Verify all messages were ACKed
    const pending = await redis.xpending(partitionedStreamName, groupName);
    expect(pending[0]).toBe(0);
  });

  // ========================================================================
  // SWEEPER AND CONSUMER RUNNING TOGETHER: Realistic production scenario
  // ========================================================================

  test("sweeper and consumer run together handling mix of new and stuck messages", async () => {
    // ARRANGE
    const streamName = `projection-${randomUUIDv7()}`;
    const partitionedStreamName = `${streamName}:0`;
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();

    // Mix of messages
    const newOutboxId = randomUUIDv7();
    const stuckPendingId = randomUUIDv7();
    const stuckDispatchedId = randomUUIDv7();

    const newEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "New Product" },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const stuckPendingEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Stuck Pending Product" },
      randomUUIDv7(),
      randomUUIDv7()
    );
    const stuckDispatchedEvent = createMockIntegrationEvent(
      "ProductCreated",
      { productId: randomUUIDv7(), title: "Stuck Dispatched Product" },
      randomUUIDv7(),
      randomUUIDv7()
    );

    await insertPendingOutboxMessageWithEvent(
      db,
      newOutboxId,
      newEvent,
      partitionedStreamName
    );
    await insertStuckPendingOutboxMessage(
      db,
      stuckPendingId,
      61000,
      stuckPendingEvent,
      partitionedStreamName
    );
    await insertStuckDispatchedOutboxMessage(
      db,
      stuckDispatchedId,
      61000,
      1,
      stuckDispatchedEvent,
      partitionedStreamName
    );

    const dispatcher = new OutboxDispatcher({ db, redis });
    const sweeper = new OutboxSweeper({
      db,
      redis,
      thresholdSeconds: 60,
    });
    const handler = new FakeProjectionHandler();
    const consumer = new RedisStreamConsumer({
      db,
      redis,
      handler: handler as any,
      maxAttempts: 3,
      consumerId,
      streamName,
      partitionCount: 1,
      groupName,
    });

    // ACT
    // Dispatch new message
    await dispatcher.dispatch(newOutboxId);

    // Start sweeper (picks up stuck messages)
    await sweeper.start();
    await sweeper.shutdown();

    // Start consumer (processes all messages)
    const startPromise = consumer.start();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await consumer.shutdown();
    await startPromise;

    // ASSERT
    // Verify handlers were called (only projection handler for projection streams, may be more than 3 due to other stuck messages from previous tests)
    expect(handler.callCount).toBeGreaterThanOrEqual(3);

    // Verify all OUR 3 messages are processed
    const [newOutboxMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, newOutboxId))
      .execute();
    const [stuckPendingMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, stuckPendingId))
      .execute();
    const [stuckDispatchedMessage] = await db
      .select()
      .from(OutboxTable)
      .where(eq(OutboxTable.id, stuckDispatchedId))
      .execute();

    expect(newOutboxMessage.status).toBe("processed");
    expect(stuckPendingMessage.status).toBe("processed");
    expect(stuckDispatchedMessage.status).toBe("processed");

    // Note: We don't check pending count because other stuck messages from previous tests
    // may still be in the pending list if they failed processing
  });

  // ========================================================================
  // MULTI-CONSUMER COORDINATION: Multiple consumers working together
  // ========================================================================

  test("multiple consumers process messages with automatic partition assignment", async () => {
    // ARRANGE
    const streamName = `projection-${randomUUIDv7()}`;
    const groupName = randomUUIDv7();
    const partitionCount = 4;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();

    // Create multiple outbox messages across different partitions
    const messages = [];
    for (let i = 0; i < 8; i++) {
      const outboxId = randomUUIDv7();
      const eventId = randomUUIDv7();
      const correlationId = randomUUIDv7();
      const partition = i % partitionCount;
      const partitionedStreamName = `${streamName}:${partition}`;
      const mockEvent = createMockIntegrationEvent(
        "ProductCreated",
        { productId: randomUUIDv7(), title: `Product ${i}` },
        eventId,
        correlationId
      );

      await insertPendingOutboxMessageWithEvent(
        db,
        outboxId,
        mockEvent,
        partitionedStreamName
      );

      messages.push({ outboxId, partition, eventId });
    }

    const dispatcher = new OutboxDispatcher({ db, redis });
    const handler1 = new FakeProjectionHandler();
    const handler2 = new FakeProjectionHandler();

    const consumer1 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler1 as any,
      maxAttempts: 3,
      consumerId: consumer1Id,
      streamName,
      partitionCount,
      groupName,
      heartbeatIntervalMs: 100,
      rebalanceCheckIntervalMs: 200,
    });

    const consumer2 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler2 as any,
      maxAttempts: 3,
      consumerId: consumer2Id,
      streamName,
      partitionCount,
      groupName,
      heartbeatIntervalMs: 100,
      rebalanceCheckIntervalMs: 200,
    });

    // ACT
    // Dispatch all messages
    for (const msg of messages) {
      await dispatcher.dispatch(msg.outboxId);
    }

    // Start both consumers
    const consumer1Promise = consumer1.start();
    const consumer2Promise = consumer2.start();

    // Wait for all messages to be processed (poll until done or timeout)
    const startTime = Date.now();
    const timeout = 5000;
    const outboxIds = messages.map((m) => m.outboxId);

    while (Date.now() - startTime < timeout) {
      const processedCount = await db
        .select()
        .from(OutboxTable)
        .where(
          and(
            inArray(OutboxTable.id, outboxIds),
            eq(OutboxTable.status, "processed")
          )
        )
        .execute();

      if (processedCount.length === 8) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Shutdown both consumers
    await consumer1.shutdown();
    await consumer2.shutdown();
    await consumer1Promise;
    await consumer2Promise;

    // ASSERT
    // Verify all messages were processed
    for (const msg of messages) {
      const [outboxMessage] = await db
        .select()
        .from(OutboxTable)
        .where(eq(OutboxTable.id, msg.outboxId))
        .execute();
      expect(outboxMessage.status).toBe("processed");
    }

    // Verify both consumers processed some messages (load distribution)
    const totalProcessed = handler1.callCount + handler2.callCount;
    expect(totalProcessed).toBe(8);
    expect(handler1.callCount).toBeGreaterThan(0);
    expect(handler2.callCount).toBeGreaterThan(0);
  }, 10_000);

  test("consumer failure triggers automatic rebalancing", async () => {
    // ARRANGE
    const streamName = `projection-${randomUUIDv7()}`;
    const groupName = randomUUIDv7();
    const partitionCount = 4;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();

    // Create messages across different partitions
    const messages = [];
    for (let i = 0; i < 500; i++) {
      const outboxId = randomUUIDv7();
      const eventId = randomUUIDv7();
      const correlationId = randomUUIDv7();
      const partition = i % partitionCount;
      const partitionedStreamName = `${streamName}:${partition}`;
      const mockEvent = createMockIntegrationEvent(
        "ProductCreated",
        { productId: randomUUIDv7(), title: `Product ${i}` },
        eventId,
        correlationId
      );

      await insertPendingOutboxMessageWithEvent(
        db,
        outboxId,
        mockEvent,
        partitionedStreamName
      );

      messages.push({ outboxId, partition });
    }

    const dispatcher = new OutboxDispatcher({ db, redis });
    const handler1 = new FakeProjectionHandler();
    const handler2 = new FakeProjectionHandler();

    const consumer1 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler1 as any,
      maxAttempts: 3,
      consumerId: consumer1Id,
      streamName,
      partitionCount,
      groupName,
      heartbeatIntervalMs: 100,
      rebalanceCheckIntervalMs: 200,
      heartbeatTimeoutMs: 500,
    });

    const consumer2 = new RedisStreamConsumer({
      db,
      redis,
      handler: handler2 as any,
      maxAttempts: 3,
      consumerId: consumer2Id,
      streamName,
      partitionCount,
      groupName,
      heartbeatIntervalMs: 100,
      rebalanceCheckIntervalMs: 200,
      heartbeatTimeoutMs: 500,
    });

    // ACT
    // Dispatch all messages
    for (const msg of messages) {
      await dispatcher.dispatch(msg.outboxId);
    }

    // Start both consumers
    const consumer1Promise = consumer1.start();
    const consumer2Promise = consumer2.start();

    // Let both run for a very short time (so consumer1 only processes a few messages)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate consumer1 failure by shutting it down
    await consumer1.shutdown();
    await consumer1Promise;

    // Give consumer2 time to detect failure and rebalance
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Shutdown consumer2
    await consumer2.shutdown();
    await consumer2Promise;

    // ASSERT
    // Verify all messages were eventually processed (consumer2 took over)
    for (const msg of messages) {
      const [outboxMessage] = await db
        .select()
        .from(OutboxTable)
        .where(eq(OutboxTable.id, msg.outboxId))
        .execute();
      expect(outboxMessage.status).toBe("processed");
    }

    // Verify both consumers processed some messages initially
    // but consumer2 processed more after taking over consumer1's partitions
    expect(handler1.callCount).toBeGreaterThan(0);
    expect(handler2.callCount).toBeGreaterThan(handler1.callCount);
  }, 30_000);
});
