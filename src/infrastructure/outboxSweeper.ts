import type { IntegrationEvent } from "../integrationEvents/_base";
import type { DB } from "./postgres";
import type { RedisClient } from "./redis";
import { OutboxTable, UndeliverableMessagesDeadLetterQueueTable } from "./orm";
import { inArray, or, sql, and, eq, lt } from "drizzle-orm";

type OutboxSweeperProps = {
  db: DB;
  redis: RedisClient;
  sweepIntervalMs?: number;
  thresholdSeconds?: number;
  streamName?: string;
};

/**
 * OutboxSweeper runs periodically to republish stuck messages.
 *
 * Recovery mechanism for messages that:
 * - Failed to dispatch initially (status='pending')
 * - Were dispatched but never processed (status='dispatched' older than threshold)
 * - Were dispatched but Redis lost them (stream entry missing)
 *
 * Sweeps every `sweepIntervalMs` (default: 60s) and targets messages
 * older than `thresholdSeconds` (default: 60s).
 *
 * Uses FOR UPDATE SKIP LOCKED to avoid contention with other sweepers.
 */
export class OutboxSweeper {
  private db: DB;
  private redis: RedisClient;
  private sweepIntervalMs: number;
  private thresholdSeconds: number;
  private isRunning: boolean = false;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor({
    db,
    redis,
    sweepIntervalMs = 60000, // 60 seconds
    thresholdSeconds = 60, // 60 seconds
  }: OutboxSweeperProps) {
    this.db = db;
    this.redis = redis;
    this.sweepIntervalMs = sweepIntervalMs;
    this.thresholdSeconds = thresholdSeconds;
  }

  /**
   * Start the sweeper loop.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("OutboxSweeper: Already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `OutboxSweeper: Starting (interval: ${this.sweepIntervalMs}ms, threshold: ${this.thresholdSeconds}s)`
    );

    // Run first sweep immediately, then at intervals
    await this.sweep();
    this.scheduleNextSweep();
  }

  /**
   * Schedule the next sweep.
   */
  private scheduleNextSweep(): void {
    if (!this.isRunning) return;

    this.sweepTimer = setTimeout(async () => {
      try {
        await this.sweep();
      } catch (error) {
        console.error("OutboxSweeper: Error during sweep:", error);
      }
      this.scheduleNextSweep();
    }, this.sweepIntervalMs);
  }

  /**
   * Execute one sweep cycle.
   *
   * Processes each message individually in its own transaction to avoid
   * holding locks on large batches and to allow partial success when
   * some messages fail.
   */
  private async sweep(): Promise<void> {
    const startTime = Date.now();
    const thresholdTime = new Date(Date.now() - this.thresholdSeconds * 1000);

    try {
      // Query for candidate stuck messages WITHOUT locks
      // For pending messages: check createdAt
      // For dispatched messages: check dispatchedAt (not createdAt)
      // This ensures we don't keep republishing recently dispatched messages
      const candidates = await this.db
        .select({
          id: OutboxTable.id,
          status: OutboxTable.status,
          attempts: OutboxTable.attempts,
          event: OutboxTable.event,
          dispatchedAt: OutboxTable.dispatchedAt,
          createdAt: OutboxTable.createdAt,
        })
        .from(OutboxTable)
        .where(
          and(
            or(
              // Pending messages stuck since creation
              and(
                eq(OutboxTable.status, "pending"),
                lt(OutboxTable.createdAt, thresholdTime)
              ),
              // Dispatched messages stuck since last dispatch
              and(
                eq(OutboxTable.status, "dispatched"),
                lt(OutboxTable.dispatchedAt, thresholdTime)
              )
            )
          )
        )
        .orderBy(
          sql`COALESCE(${OutboxTable.dispatchedAt}, ${OutboxTable.createdAt})`
        )
        .limit(200)
        .execute();

      if (candidates.length === 0) {
        console.log("OutboxSweeper: No stuck messages found");
        return;
      }

      console.log(
        `OutboxSweeper: Found ${candidates.length} stuck messages, republishing...`
      );

      let successCount = 0;
      let failureCount = 0;

      // Process each message in its own transaction
      for (const candidate of candidates) {
        try {
          await this.db.transaction(async (tx) => {
            // Re-select with FOR UPDATE SKIP LOCKED to claim the message
            const [locked] = await tx
              .select()
              .from(OutboxTable)
              .where(eq(OutboxTable.id, candidate.id))
              .for("update", { skipLocked: true })
              .execute();

            if (!locked) {
              // Another worker got it, skip
              return;
            }

            // Re-check threshold - message might have been processed by another worker
            // after we queried candidates but before we acquired the lock
            const messageTime =
              locked.status === "dispatched" && locked.dispatchedAt
                ? locked.dispatchedAt
                : locked.createdAt;
            if (messageTime >= thresholdTime) {
              // Message no longer meets threshold, skip
              return;
            }

            // Check if attempts threshold exceeded
            if (locked.attempts >= 10) {
              await this.moveToUndeliverable(
                tx,
                locked,
                "Max attempts exceeded (10)"
              );
              console.log(
                `OutboxSweeper: Moved message ${locked.id} to undeliverable (${locked.attempts} attempts)`
              );
              return;
            }

            // Publish to Redis stream
            const integrationEvent = locked.event as IntegrationEvent<
              string,
              Record<string, unknown>
            >;

            await this.redis.xadd(
              locked.streamName,
              "*",
              "outbox_id",
              locked.id,
              "type",
              integrationEvent.eventName,
              "payload",
              JSON.stringify(integrationEvent)
            );

            // Update status to dispatched
            await tx
              .update(OutboxTable)
              .set({
                status: "dispatched",
                dispatchedAt: new Date(),
                attempts: locked.attempts + 1,
              })
              .where(eq(OutboxTable.id, locked.id))
              .execute();

            console.log(
              `OutboxSweeper: Republished message ${locked.id} (attempt ${
                locked.attempts + 1
              })`
            );
          });

          successCount++;
        } catch (error) {
          // Individual failure doesn't affect other messages
          console.error(
            `OutboxSweeper: Failed to process message ${candidate.id}:`,
            error
          );
          failureCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(
        `OutboxSweeper: Completed sweep in ${duration}ms (success: ${successCount}, failures: ${failureCount})`
      );
    } catch (error) {
      console.error("OutboxSweeper: Error during sweep:", error);
    }
  }

  /**
   * Move a message to the undeliverable dead letter queue.
   *
   * Called when a message has exceeded the maximum number of delivery attempts (10).
   * These are messages that the sweeper couldn't successfully push to Redis.
   */
  private async moveToUndeliverable(
    tx: any,
    message: {
      id: string;
      event: unknown;
      attempts: number;
      createdAt: Date;
      dispatchedAt: Date | null;
    },
    error: string
  ): Promise<void> {
    await tx
      .insert(UndeliverableMessagesDeadLetterQueueTable)
      .values({
        id: message.id,
        event: message.event,
        attempts: message.attempts,
        originalCreatedAt: message.createdAt,
        lastAttemptedAt: message.dispatchedAt || message.createdAt,
        failedAt: new Date(),
        lastError: error,
      })
      .execute();

    await tx
      .delete(OutboxTable)
      .where(eq(OutboxTable.id, message.id))
      .execute();
  }

  /**
   * Gracefully shutdown the sweeper.
   */
  async shutdown(): Promise<void> {
    console.log("OutboxSweeper: Shutdown requested");
    this.isRunning = false;

    if (this.sweepTimer) {
      clearTimeout(this.sweepTimer);
      this.sweepTimer = null;
    }

    console.log("OutboxSweeper: Shutdown complete");
  }
}
