import type { IntegrationEvent } from "../integrationEvents/_base";
import type { DB } from "./postgres";
import type { RedisClient } from "./redis";
import { OutboxTable, UnprocessableMessagesDeadLetterQueueTable } from "./orm";
import { eq } from "drizzle-orm";
import { ProjectionHandler } from "../views/projections/projectionHandler";
import { ExternalEffectHandler } from "./externalEffectHandler";
import { ConsumerCoordinator } from "./consumerCoordinator";

type RedisStreamConsumerProps = {
  db: DB;
  redis: RedisClient;
  handler: ProjectionHandler | ExternalEffectHandler;
  maxAttempts: number;
  consumerId: string;
  streamName: string;
  partitionCount: number;
  groupName: string;
  heartbeatIntervalMs?: number;
  rebalanceCheckIntervalMs?: number;
  heartbeatTimeoutMs?: number;
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
  private handler: ProjectionHandler | ExternalEffectHandler;
  private maxAttempts: number;
  private consumerId: string;
  private isShuttingDown: boolean = false;
  private inFlightOperations: number = 0;
  private readonly streamName: string;
  private readonly partitionCount: number;
  private readonly groupName: string;
  private readonly batchSize = 32;
  private readonly blockMs = 1000;
  private shutdownTimeoutMs = 30000;
  private coordinator: ConsumerCoordinator;
  private heartbeatIntervalMs: number;
  private rebalanceCheckIntervalMs: number;
  private heartbeatTimer: Timer | null = null;
  private rebalanceCheckTimer: Timer | null = null;
  private assignedStreamNames: string[] = [];
  private currentGeneration: number = 0;

  constructor({
    db,
    redis,
    handler,
    maxAttempts,
    consumerId,
    streamName,
    partitionCount,
    groupName,
    heartbeatIntervalMs = 10000,
    rebalanceCheckIntervalMs = 15000,
    heartbeatTimeoutMs = 30000,
  }: RedisStreamConsumerProps) {
    this.db = db;
    this.redis = redis;
    this.handler = handler;
    this.maxAttempts = maxAttempts;
    this.consumerId = consumerId;
    this.streamName = streamName;
    this.partitionCount = partitionCount;
    this.groupName = groupName;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.rebalanceCheckIntervalMs = rebalanceCheckIntervalMs;

    this.coordinator = new ConsumerCoordinator({
      redis,
      consumerId,
      groupName,
      partitionCount,
      streamName,
      heartbeatTimeoutMs,
    });
  }

  /**
   * Initialize the consumer group if it doesn't exist.
   */
  private async ensureConsumerGroup(streamName: string): Promise<void> {
    try {
      // Try to create the consumer group
      // MKSTREAM creates the stream if it doesn't exist
      await this.redis.xgroup(
        "CREATE",
        streamName,
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
    console.log(
      `RedisStreamConsumer: Starting consumer ${this.consumerId} on group ${this.groupName}`
    );

    // Register with coordinator and get initial partition assignment
    const assignment = await this.coordinator.registerConsumer();
    this.currentGeneration = assignment.generation;
    this.assignedStreamNames = this.coordinator.getStreamNamesForPartitions(
      assignment.partitions
    );

    console.log(
      `RedisStreamConsumer: Assigned partitions ${assignment.partitions.join(
        ", "
      )} (generation ${assignment.generation})`
    );

    // Ensure consumer groups exist for all assigned streams
    await Promise.all(
      this.assignedStreamNames.map((s) => this.ensureConsumerGroup(s))
    );

    // Start background heartbeat loop
    this.startHeartbeatLoop();

    // Start background rebalance check loop
    this.startRebalanceCheckLoop();

    while (!this.isShuttingDown) {
      try {
        if (this.assignedStreamNames.length === 0) {
          // No partitions assigned, wait for rebalance
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        await this.consumeBatch(this.assignedStreamNames);
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
  private async consumeBatch(streamNames: string[]): Promise<void> {
    // XREADGROUP blocks until messages available or timeout
    // Redis requires one ID per stream, so we need to provide ">" for each stream
    const streamIds = streamNames.map(() => ">");
    const results = await this.redis.xreadgroup(
      "GROUP",
      this.groupName,
      this.consumerId,
      "COUNT",
      this.batchSize,
      "BLOCK",
      this.blockMs,
      "STREAMS",
      ...streamNames,
      ...streamIds // Read new messages not yet delivered to any consumer
    );

    if (!results || results.length === 0) {
      return; // No messages, continue loop
    }

    // results format: [[streamName, [[messageId, [field, value, field, value, ...]]]]]
    // When reading from multiple streams, we need to process all of them
    for (const streamResult of results as [string, [string, string[]][]][]) {
      const [streamName, messages] = streamResult;

      for (const [messageId, fields] of messages as [string, string[]][]) {
        this.inFlightOperations++;
        try {
          await this.processMessage(streamName, messageId, fields);
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
  }

  /**
   * Process a single message from the stream.
   */
  private async processMessage(
    streamName: string,
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
      await this.redis.xack(streamName, this.groupName, messageId);
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
        await this.redis.xack(streamName, this.groupName, messageId);
        return;
      }

      if (outboxMessage.status === "processed") {
        console.log(
          `RedisStreamConsumer: Message ${outboxId} already processed, ACKing`
        );
        await this.redis.xack(streamName, this.groupName, messageId);
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
        await this.redis.xack(streamName, this.groupName, messageId);
        return;
      }

      // Process the message
      const result = await this.handler.handleIntegrationEvent(
        integrationEvent
      );
      if (!result.success) {
        console.error(
          `RedisStreamConsumer: Failed to process message ${outboxId}:`,
          result.error
        );
        // Don't ACK - message stays in PEL for retry via sweeper or XAUTOCLAIM
        return;
      }

      // Mark as processed and ACK
      await this.markAsProcessed(outboxId);
      await this.redis.xack(streamName, this.groupName, messageId);

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
   * Start background loop to send heartbeats.
   */
  private startHeartbeatLoop(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }
      try {
        await this.coordinator.sendHeartbeat();
      } catch (error) {
        console.error("RedisStreamConsumer: Error sending heartbeat:", error);
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Start background loop to check for rebalancing.
   */
  private startRebalanceCheckLoop(): void {
    this.rebalanceCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }
      try {
        const newAssignment = await this.coordinator.checkForRebalance();
        if (newAssignment) {
          console.log(
            `RedisStreamConsumer: Rebalancing detected, new partitions: ${newAssignment.partitions.join(
              ", "
            )} (generation ${newAssignment.generation})`
          );
          this.currentGeneration = newAssignment.generation;
          const newStreamNames = this.coordinator.getStreamNamesForPartitions(
            newAssignment.partitions
          );

          // Ensure consumer groups exist for new streams
          const streamsToAdd = newStreamNames.filter(
            (s) => !this.assignedStreamNames.includes(s)
          );
          if (streamsToAdd.length > 0) {
            await Promise.all(
              streamsToAdd.map((s) => this.ensureConsumerGroup(s))
            );
          }

          this.assignedStreamNames = newStreamNames;
        }
      } catch (error) {
        console.error(
          "RedisStreamConsumer: Error checking for rebalance:",
          error
        );
      }
    }, this.rebalanceCheckIntervalMs);
  }

  /**
   * Stop background loops.
   */
  private stopBackgroundLoops(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.rebalanceCheckTimer) {
      clearInterval(this.rebalanceCheckTimer);
      this.rebalanceCheckTimer = null;
    }
  }

  /**
   * Gracefully shutdown the consumer.
   */
  async shutdown(): Promise<void> {
    console.log("RedisStreamConsumer: Shutdown requested");
    this.isShuttingDown = true;

    // Stop background loops
    this.stopBackgroundLoops();

    // Remove consumer from coordinator
    try {
      await this.coordinator.removeConsumer();
    } catch (error) {
      console.error(
        "RedisStreamConsumer: Error removing consumer from coordinator:",
        error
      );
    }
  }
}
