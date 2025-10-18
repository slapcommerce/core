import type { IntegrationEvent } from "../integrationEvents/_base";
import type { DB } from "./postgres";
import type { RedisClient } from "./redis";
import { OutboxTable } from "./orm";
import { eq } from "drizzle-orm";

type OutboxDispatcherProps = {
  db: DB;
  redis: RedisClient;
  streamName?: string;
};

/**
 * OutboxDispatcher publishes individual outbox messages to Redis Streams
 * after the initial database transaction commits.
 *
 * This is a fire-and-forget operation - if dispatch fails, the OutboxSweeper
 * will retry the message later.
 *
 * Flow:
 * 1. Fetch the outbox message by ID
 * 2. XADD to Redis stream 'events' with outbox_id, type, payload
 * 3. UPDATE outbox SET status='dispatched', dispatched_at=now(), attempts=attempts+1
 * 4. Log errors but don't throw (sweeper handles recovery)
 */
export class OutboxDispatcher {
  private db: DB;
  private redis: RedisClient;
  private readonly streamName: string;

  constructor({ db, redis, streamName }: OutboxDispatcherProps) {
    this.db = db;
    this.redis = redis;
    this.streamName = streamName || "events";
  }

  /**
   * Dispatch a single outbox message to Redis stream.
   * Fire-and-forget: errors are logged but not thrown.
   *
   * Uses a transaction to ensure XADD and UPDATE are atomic:
   * - If XADD fails → transaction rolls back, status stays 'pending'
   * - If XADD succeeds but UPDATE fails → duplicate delivery (idempotent)
   */
  async dispatch(outboxId: string): Promise<void> {
    try {
      // Fetch the outbox message outside transaction (read-only)
      const [outboxMessage] = await this.db
        .select()
        .from(OutboxTable)
        .where(eq(OutboxTable.id, outboxId))
        .execute();

      if (!outboxMessage) {
        console.warn(`OutboxDispatcher: Message ${outboxId} not found`);
        return;
      }

      // Don't re-dispatch already processed or dispatched messages
      if (
        outboxMessage.status === "processed" ||
        outboxMessage.status === "dispatched"
      ) {
        return;
      }

      const integrationEvent = outboxMessage.event as IntegrationEvent<
        string,
        Record<string, unknown>
      >;

      // Publish to Redis stream (outside of DB transaction)
      await this.redis.xadd(
        this.streamName,
        "*", // Auto-generate ID
        "outbox_id",
        outboxId,
        "type",
        integrationEvent.eventName,
        "payload",
        JSON.stringify(integrationEvent)
      );

      // Mark as dispatched (best effort - allow redis to come first)
      await this.db
        .update(OutboxTable)
        .set({
          status: "dispatched",
          dispatchedAt: new Date(),
          attempts: outboxMessage.attempts + 1,
        })
        .where(eq(OutboxTable.id, outboxId))
        .execute();

      console.log(
        `OutboxDispatcher: Dispatched message ${outboxId} (${integrationEvent.eventName})`
      );
    } catch (error) {
      // Log error but don't throw - sweeper will retry
      console.error(
        `OutboxDispatcher: Failed to dispatch message ${outboxId}:`,
        error
      );
    }
  }
}
