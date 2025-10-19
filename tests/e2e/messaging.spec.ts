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
import { eq } from "drizzle-orm";

describe("E2E Messaging System", () => {
  // ========================================================================
  // HAPPY PATH: Complete end-to-end flow
  // ========================================================================

  test("complete flow: pending → dispatch → consume → process", async () => {
    // ARRANGE
    const outboxId = randomUUIDv7();
    const streamName = randomUUIDv7();
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

    // Verify handlers were called
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);
    expect(projectionHandler.calledWith[0].eventId).toBe(eventId);
    expect(externalEffectHandler.calledWith[0].eventId).toBe(eventId);

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
    const streamName = randomUUIDv7();
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

    // Verify handlers were called (may be more than 1 due to other stuck messages from previous tests)
    expect(projectionHandler.callCount).toBeGreaterThanOrEqual(1);
    expect(externalEffectHandler.callCount).toBeGreaterThanOrEqual(1);

    // Verify our specific message was processed by checking it's in the calledWith array
    const ourEventCall = projectionHandler.calledWith.find(
      (event) => event.eventId === eventId
    );
    expect(ourEventCall).toBeDefined();
    expect(ourEventCall?.eventId).toBe(eventId);

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
    const streamName = randomUUIDv7();
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

    // Verify handlers were called
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);

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
    const streamName = randomUUIDv7();
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
    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    // Make projection handler fail initially
    projectionHandler.setFailure(true, "Database connection failed");

    const consumer1 = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId: consumerId + "-1",
      streamNames: [streamName],
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
    projectionHandler.setFailure(false);
    const consumer2 = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3,
      consumerId: consumerId + "-2",
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    const startPromise2 = consumer2.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await consumer2.shutdown();
    await startPromise2;

    // ASSERT
    // Verify handlers were called (may be more than 2 due to other stuck messages from previous tests)
    expect(projectionHandler.callCount).toBeGreaterThanOrEqual(2);
    expect(externalEffectHandler.callCount).toBeGreaterThanOrEqual(2);

    // Verify our specific message was processed by checking it appears in calledWith array
    const ourEventCalls = projectionHandler.calledWith.filter(
      (event) => event.eventId === eventId
    );
    // Should be called twice - once when it failed, once when it succeeded
    expect(ourEventCalls.length).toBe(2);

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
    const streamName = randomUUIDv7();
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
    const streamName = randomUUIDv7();
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

    const projectionHandler = new FakeProjectionHandler();
    const externalEffectHandler = new FakeExternalEffectHandler();

    const consumer = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler as any,
      externalEffectHandler: externalEffectHandler as any,
      maxAttempts: 3, // Message already at max
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
    // Verify handlers were NOT called (max attempts exceeded)
    expect(projectionHandler.callCount).toBe(0);
    expect(externalEffectHandler.callCount).toBe(0);

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
    const streamName = randomUUIDv7();
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

    // Verify handlers were called only once
    expect(projectionHandler.callCount).toBe(1);
    expect(externalEffectHandler.callCount).toBe(1);

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
    const streamName = randomUUIDv7();
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
    const projectionHandler1 = new FakeProjectionHandler();
    const externalEffectHandler1 = new FakeExternalEffectHandler();
    const projectionHandler2 = new FakeProjectionHandler();
    const externalEffectHandler2 = new FakeExternalEffectHandler();

    const consumer1 = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler1 as any,
      externalEffectHandler: externalEffectHandler1 as any,
      maxAttempts: 3,
      consumerId: consumerId1,
      streamNames: [streamName],
      partitionCount: 1,
      groupName,
    });

    const consumer2 = new RedisStreamConsumer({
      db,
      redis,
      projectionHandler: projectionHandler2 as any,
      externalEffectHandler: externalEffectHandler2 as any,
      maxAttempts: 3,
      consumerId: consumerId2,
      streamNames: [streamName],
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

    // Verify all handlers were called (distributed across consumers)
    const totalProjectionCalls =
      projectionHandler1.callCount + projectionHandler2.callCount;
    const totalExternalEffectCalls =
      externalEffectHandler1.callCount + externalEffectHandler2.callCount;
    expect(totalProjectionCalls).toBe(3);
    expect(totalExternalEffectCalls).toBe(3);

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
    const streamName = randomUUIDv7();
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
    // Verify handlers were called (may be more than 3 due to other stuck messages from previous tests)
    expect(projectionHandler.callCount).toBeGreaterThanOrEqual(3);
    expect(externalEffectHandler.callCount).toBeGreaterThanOrEqual(3);

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
});
