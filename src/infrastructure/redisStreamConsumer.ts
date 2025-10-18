import type { IntegrationEvent } from "../integrationEvents/_base";
import type { DB } from "./postgres";
import type { RedisClient } from "./redis";
import { OutboxTable, UnprocessableMessagesDeadLetterQueueTable } from "./orm";
import { eq } from "drizzle-orm";
import { ProjectionHandler } from "../views/projections/projectionHandler";
import { ExternalEffectHandler } from "./externalEffectHandler";
import { v4 as uuidv4 } from "uuid";

type RedisStreamConsumerProps = {
  db: DB;
  redis: RedisClient;
  projectionHandler: ProjectionHandler;
  externalEffectHandler: ExternalEffectHandler;
  maxAttempts: number;
  consumerId?: string;
  streamName?: string;
  groupName?: string;
};

/**
 * RedisStreamConsumer reads messages from Redis Streams and processes them.
 *
 * Uses consumer groups for load balancing across multiple workers.
 * Messages are processed idempotently using outbox_id as the key.
 *
 * Flow per message:
 * 1. XREADGROUP to read messages from stream
 * 2. Start DB transaction
 * 3. Call projectionHandler and externalEffectHandler (idempotent)
 * 4. UPDATE outbox SET status='processed', processed_at=now()
 * 5. COMMIT transaction
 * 6. XACK the message
 *
 * On failure: message stays in PEL (Pending Entries List) for retry.
 * After maxAttempts: move to UnprocessableMessagesDeadLetterQueueTable and XACK to prevent reprocessing.
 */
export class RedisStreamConsumer {
  private db: DB;
  private redis: RedisClient;
  private projectionHandler: ProjectionHandler;
  private externalEffectHandler: ExternalEffectHandler;
  private maxAttempts: number;
  private consumerId: string;
  private isShuttingDown: boolean = false;
  private inFlightOperations: number = 0;
  private readonly streamName: string;
  private readonly groupName: string;
  private readonly batchSize = 32;
  private readonly blockMs = 1000;
  private shutdownTimeoutMs = 30000;

  constructor({
    db,
    redis,
    projectionHandler,
    externalEffectHandler,
    maxAttempts,
    consumerId,
    streamName,
    groupName,
  }: RedisStreamConsumerProps) {
    this.db = db;
    this.redis = redis;
    this.projectionHandler = projectionHandler;
    this.externalEffectHandler = externalEffectHandler;
    this.maxAttempts = maxAttempts;
    this.consumerId = consumerId || `consumer-${uuidv4()}`;
    this.streamName = streamName || "events";
    this.groupName = groupName || "events-cg";
  }

  /**
   * Initialize the consumer group if it doesn't exist.
   */
  private async ensureConsumerGroup(): Promise<void> {
    try {
      // Try to create the consumer group
      // MKSTREAM creates the stream if it doesn't exist
      await this.redis.xgroup(
        "CREATE",
        this.streamName,
        this.groupName,
        "0", // Start from beginning for new group
        "MKSTREAM"
      );
      console.log(
        `RedisStreamConsumer: Created consumer group ${this.groupName}`
      );
    } catch (error: any) {
      // BUSYGROUP error means group already exists, which is fine
      if (!error.message?.includes("BUSYGROUP")) {
        throw error;
      }
    }
  }

  /**
   * Start consuming messages from the Redis stream.
   */
  async start(): Promise<void> {
    await this.ensureConsumerGroup();

    console.log(
      `RedisStreamConsumer: Starting consumer ${this.consumerId} on group ${this.groupName}`
    );

    while (!this.isShuttingDown) {
      try {
        await this.consumeBatch();
      } catch (error) {
        console.error("RedisStreamConsumer: Error in consume loop:", error);
        // If connection is closed, exit the loop
        if (
          error instanceof Error &&
          error.message.includes("Connection is closed")
        ) {
          console.log(
            "RedisStreamConsumer: Redis connection closed, stopping consumer"
          );
          break;
        }
        // Brief pause before retrying to avoid tight error loops
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      "RedisStreamConsumer: Consume loop stopped, waiting for in-flight operations"
    );
    await this.waitForInFlightOperations();
    console.log(
      "RedisStreamConsumer: All operations completed, shutdown complete"
    );
  }

  /**
   * Consume and process a batch of messages.
   */
  private async consumeBatch(): Promise<void> {
    // XREADGROUP blocks until messages available or timeout
    const results = await this.redis.xreadgroup(
      "GROUP",
      this.groupName,
      this.consumerId,
      "COUNT",
      this.batchSize,
      "BLOCK",
      this.blockMs,
      "STREAMS",
      this.streamName,
      ">" // Read new messages not yet delivered to any consumer
    );

    if (!results || results.length === 0) {
      return; // No messages, continue loop
    }

    // results format: [[streamName, [[messageId, [field, value, field, value, ...]]]]]
    const [_streamName, messages] = results[0] as [
      string,
      [string, string[]][],
    ];

    for (const [messageId, fields] of messages as [string, string[]][]) {
      this.inFlightOperations++;
      try {
        await this.processMessage(messageId, fields);
      } catch (error) {
        console.error(
          `RedisStreamConsumer: Error processing message ${messageId}:`,
          error
        );
      } finally {
        this.inFlightOperations--;
      }
    }
  }

  /**
   * Process a single message from the stream.
   */
  private async processMessage(
    messageId: string,
    fields: string[]
  ): Promise<void> {
    // Parse fields (Redis returns flat array: [key1, val1, key2, val2, ...])
    const fieldMap = this.parseFields(fields);
    const outboxId = fieldMap.outbox_id;
    const payloadStr = fieldMap.payload;

    if (!outboxId || !payloadStr) {
      console.error(
        `RedisStreamConsumer: Missing required fields in message ${messageId}`
      );
      // ACK malformed message to remove from stream
      await this.redis.xack(this.streamName, this.groupName, messageId);
      return;
    }

    try {
      const integrationEvent = JSON.parse(payloadStr) as IntegrationEvent<
        string,
        Record<string, unknown>
      >;

      // Check if already processed
      const [outboxMessage] = await this.db
        .select()
        .from(OutboxTable)
        .where(eq(OutboxTable.id, outboxId))
        .execute();

      if (!outboxMessage) {
        console.warn(
          `RedisStreamConsumer: Outbox message ${outboxId} not found, ACKing`
        );
        await this.redis.xack(this.streamName, this.groupName, messageId);
        return;
      }

      if (outboxMessage.status === "processed") {
        console.log(
          `RedisStreamConsumer: Message ${outboxId} already processed, ACKing`
        );
        await this.redis.xack(this.streamName, this.groupName, messageId);
        return;
      }

      // Check if max attempts exceeded
      if (outboxMessage.attempts >= this.maxAttempts) {
        console.warn(
          `RedisStreamConsumer: Message ${outboxId} exceeded max attempts, moving to DLQ`
        );
        await this.moveToDeadLetterQueue(
          outboxId,
          integrationEvent,
          `Exceeded max attempts (${this.maxAttempts})`
        );
        await this.redis.xack(this.streamName, this.groupName, messageId);
        return;
      }

      // Process the message
      const result = await this.handleIntegrationEvent(
        outboxId,
        integrationEvent
      );

      if (!result.success) {
        console.error(
          `RedisStreamConsumer: Failed to process message ${outboxId}:`,
          result.errors
        );
        // Don't ACK - message stays in PEL for retry via sweeper or XAUTOCLAIM
        return;
      }

      // Mark as processed and ACK
      await this.markAsProcessed(outboxId);
      await this.redis.xack(this.streamName, this.groupName, messageId);

      console.log(
        `RedisStreamConsumer: Successfully processed and ACKed message ${outboxId}`
      );
    } catch (error) {
      console.error(
        `RedisStreamConsumer: Exception processing message ${messageId}:`,
        error
      );
      // Don't ACK on exception - let it retry
    }
  }

  /**
   * Parse Redis stream fields from flat array to map.
   */
  private parseFields(fields: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      if (key !== undefined && value !== undefined) {
        map[key] = value;
      }
    }
    return map;
  }

  /**
   * Handle the integration event by calling both handlers.
   */
  private async handleIntegrationEvent(
    outboxId: string,
    integrationEvent: IntegrationEvent<string, Record<string, unknown>>
  ): Promise<{ success: true } | { success: false; errors: string[] }> {
    const [projectionResult, externalEffectResult] = await Promise.all([
      this.projectionHandler.handleIntegrationEvent(integrationEvent),
      this.externalEffectHandler.handleIntegrationEvent(integrationEvent),
    ]);

    const hasErrors =
      projectionResult.success !== true ||
      externalEffectResult.success !== true;

    if (hasErrors) {
      const errors: string[] = [
        `ProjectionHandler: ${projectionResult.error ?? "None"}`,
        `ExternalEffectHandler: ${externalEffectResult.error ?? "None"}`,
      ];
      return { success: false, errors };
    }

    return { success: true };
  }

  /**
   * Mark outbox message as processed.
   */
  private async markAsProcessed(outboxId: string): Promise<void> {
    await this.db
      .update(OutboxTable)
      .set({
        status: "processed",
        processedAt: new Date(),
      })
      .where(eq(OutboxTable.id, outboxId))
      .execute();
  }

  /**
   * Move message to dead letter queue for unprocessable messages.
   * These are messages that successfully reached Redis but couldn't be processed.
   */
  private async moveToDeadLetterQueue(
    outboxId: string,
    integrationEvent: IntegrationEvent<string, Record<string, unknown>>,
    error: string
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(OutboxTable)
        .where(eq(OutboxTable.id, outboxId))
        .execute();

      await tx
        .insert(UnprocessableMessagesDeadLetterQueueTable)
        .values({
          id: outboxId,
          failedAt: new Date(),
          event: integrationEvent,
          lastError: error,
        })
        .onConflictDoNothing()
        .execute();
    });
  }

  /**
   * Wait for in-flight operations to complete during shutdown.
   */
  private async waitForInFlightOperations(): Promise<void> {
    const checkIntervalMs = 100;
    const startTime = Date.now();

    while (this.inFlightOperations > 0) {
      if (Date.now() - startTime > this.shutdownTimeoutMs) {
        console.warn(
          `RedisStreamConsumer: Shutdown timeout reached with ${this.inFlightOperations} operations still in-flight`
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }
  }

  /**
   * Gracefully shutdown the consumer.
   */
  async shutdown(): Promise<void> {
    console.log("RedisStreamConsumer: Shutdown requested");
    this.isShuttingDown = true;
  }
}
