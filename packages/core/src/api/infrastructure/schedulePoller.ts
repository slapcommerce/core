import type { Database } from "bun:sqlite";
import type { UnitOfWork } from "./unitOfWork";
import { DropshipVariantAggregate } from "../domain/dropshipVariant/aggregate";
import { DigitalDownloadableVariantAggregate } from "../domain/digitalDownloadableVariant/aggregate";
import { DropshipProductAggregate } from "../domain/dropshipProduct/aggregate";
import { DigitalDownloadableProductAggregate } from "../domain/digitalDownloadableProduct/aggregate";
import { randomUUIDv7 } from "bun";

export interface SchedulePollerConfig {
  /** Time interval in milliseconds between polls (default: 5000ms) */
  pollIntervalMs?: number;
  /** Maximum number of retries before marking as permanently failed (default: 5) */
  maxRetries?: number;
  /** Number of schedules to fetch per poll (default: 100) */
  batchSize?: number;
}

type ScheduleRow = {
  scheduleId: string;
  scheduleGroupId: string | null;
  aggregateId: string;
  aggregateType: string;
  scheduleType: string;
  dueAt: string;
  status: string;
  retryCount: number;
  nextRetryAt: string | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
};

type VariantAggregate = DropshipVariantAggregate | DigitalDownloadableVariantAggregate;
type ProductAggregate = DropshipProductAggregate | DigitalDownloadableProductAggregate;

/**
 * SchedulePoller polls the pendingSchedulesReadModel for due schedules
 * and executes them by triggering the appropriate aggregate methods.
 * 
 * Supports:
 * - Sale schedules (sale_start, sale_end) for variants
 * - Drop schedules (dropped) for variants and products
 */
export class SchedulePoller {
  private readonly db: Database;
  private readonly unitOfWork: UnitOfWork;
  private readonly config: Required<SchedulePollerConfig>;
  private isRunning = false;
  private pollTimer: Timer | null = null;

  constructor(
    db: Database,
    unitOfWork: UnitOfWork,
    config?: SchedulePollerConfig,
  ) {
    this.db = db;
    this.unitOfWork = unitOfWork;
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? 5000,
      maxRetries: config?.maxRetries ?? 5,
      batchSize: config?.batchSize ?? 100,
    };
  }

  /**
   * Start the polling loop.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.scheduleNextPoll();
  }

  /**
   * Stop the polling loop gracefully.
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(() => {
      this.poll()
        .catch((error) => {
          const isClosedDbError =
            error instanceof RangeError &&
            error.message.includes("closed database");
          if (isClosedDbError) {
            return;
          }
          console.error("Error in schedule poll:", error);
        })
        .finally(() => {
          this.scheduleNextPoll();
        });
    }, this.config.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    const dueSchedules = this.fetchDueSchedules();
    if (dueSchedules.length === 0) return;

    for (const schedule of dueSchedules) {
      await this.processSchedule(schedule);
    }
  }

  private fetchDueSchedules(): ScheduleRow[] {
    const now = new Date().toISOString();
    const query = this.db.query(
      `SELECT scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
              dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
              createdAt, updatedAt
       FROM pendingSchedulesReadModel
       WHERE status = 'pending' AND dueAt <= ?
         AND (nextRetryAt IS NULL OR nextRetryAt <= ?)
       ORDER BY dueAt ASC
       LIMIT ?`,
    );

    return query.all(now, now, this.config.batchSize) as ScheduleRow[];
  }

  private async processSchedule(schedule: ScheduleRow): Promise<void> {
    try {
      switch (schedule.scheduleType) {
        case "sale_start":
          await this.startSale(schedule);
          break;
        case "sale_end":
          await this.endSale(schedule);
          break;
        case "dropped":
          await this.executeDrop(schedule);
          break;
        default:
          console.warn(`Unknown schedule type: ${schedule.scheduleType}. Schedule ID: ${schedule.scheduleId}`);
          await this.markScheduleFailed(
            schedule,
            `Unknown schedule type: ${schedule.scheduleType}`,
            0, // No retries for unknown types
          );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error executing schedule ${schedule.scheduleId}:`,
        errorMessage,
      );

      await this.markScheduleFailed(schedule, errorMessage);
    }
  }

  // ============================================
  // Sale Schedule Handlers (variants only)
  // ============================================

  private async startSale(schedule: ScheduleRow): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { snapshotRepository, eventRepository, outboxRepository } = repositories;

      // Load variant aggregate based on type
      const variantSnapshot = snapshotRepository.getSnapshot(schedule.aggregateId);
      if (!variantSnapshot) {
        throw new Error(`Variant with id ${schedule.aggregateId} not found`);
      }

      const aggregate = this.loadVariantAggregate(schedule.aggregateType, variantSnapshot);

      // Start the scheduled sale
      aggregate.startScheduledSale("system");

      // Save events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: randomUUIDv7(),
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }

  private async endSale(schedule: ScheduleRow): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { snapshotRepository, eventRepository, outboxRepository } = repositories;

      // Load variant aggregate based on type
      const variantSnapshot = snapshotRepository.getSnapshot(schedule.aggregateId);
      if (!variantSnapshot) {
        throw new Error(`Variant with id ${schedule.aggregateId} not found`);
      }

      const aggregate = this.loadVariantAggregate(schedule.aggregateType, variantSnapshot);

      // End the scheduled sale
      aggregate.endScheduledSale("system");

      // Save events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: randomUUIDv7(),
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }

  // ============================================
  // Drop Schedule Handlers (variants and products)
  // ============================================

  private async executeDrop(schedule: ScheduleRow): Promise<void> {
    const isVariant = schedule.aggregateType.includes("variant");

    if (isVariant) {
      await this.executeVariantDrop(schedule);
    } else {
      await this.executeProductDrop(schedule);
    }
  }

  private async executeVariantDrop(schedule: ScheduleRow): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { snapshotRepository, eventRepository, outboxRepository } = repositories;

      // Load variant aggregate based on type
      const variantSnapshot = snapshotRepository.getSnapshot(schedule.aggregateId);
      if (!variantSnapshot) {
        throw new Error(`Variant with id ${schedule.aggregateId} not found`);
      }

      const aggregate = this.loadVariantAggregate(schedule.aggregateType, variantSnapshot);

      // Execute the drop
      aggregate.executeDrop("system");

      // Save events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: randomUUIDv7(),
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }

  private async executeProductDrop(schedule: ScheduleRow): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { snapshotRepository, eventRepository, outboxRepository } = repositories;

      // Load product aggregate based on type
      const productSnapshot = snapshotRepository.getSnapshot(schedule.aggregateId);
      if (!productSnapshot) {
        throw new Error(`Product with id ${schedule.aggregateId} not found`);
      }

      const aggregate = this.loadProductAggregate(schedule.aggregateType, productSnapshot);

      // Execute the drop
      aggregate.executeDrop("system");

      // Save events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: randomUUIDv7(),
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }

  // ============================================
  // Aggregate Loaders
  // ============================================

  private loadVariantAggregate(
    aggregateType: string,
    snapshot: { aggregateId: string; correlationId: string; version: number; payload: string },
  ): VariantAggregate {
    if (aggregateType === "dropship_variant") {
      return DropshipVariantAggregate.loadFromSnapshot(snapshot);
    } else if (aggregateType === "digital_downloadable_variant") {
      return DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);
    } else {
      throw new Error(`Unknown variant aggregate type: ${aggregateType}`);
    }
  }

  private loadProductAggregate(
    aggregateType: string,
    snapshot: { aggregateId: string; correlationId: string; version: number; payload: string },
  ): ProductAggregate {
    if (aggregateType === "dropship_product") {
      return DropshipProductAggregate.loadFromSnapshot(snapshot);
    } else if (aggregateType === "digital_downloadable_product") {
      return DigitalDownloadableProductAggregate.loadFromSnapshot(snapshot);
    } else {
      throw new Error(`Unknown product aggregate type: ${aggregateType}`);
    }
  }

  // ============================================
  // Error Handling
  // ============================================

  private async markScheduleFailed(
    schedule: ScheduleRow,
    errorMessage: string,
    maxRetries?: number,
  ): Promise<void> {
    const effectiveMaxRetries = maxRetries ?? this.config.maxRetries;
    const newRetryCount = schedule.retryCount + 1;

    if (newRetryCount >= effectiveMaxRetries) {
      // Mark as permanently failed
      this.db.run(
        `UPDATE pendingSchedulesReadModel
         SET status = 'failed', errorMessage = ?, updatedAt = ?
         WHERE scheduleId = ?`,
        [errorMessage, new Date().toISOString(), schedule.scheduleId],
      );
    } else {
      // Schedule for retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, newRetryCount), 3600000); // Max 1 hour
      const nextRetryAt = new Date(Date.now() + backoffMs);

      this.db.run(
        `UPDATE pendingSchedulesReadModel
         SET retryCount = ?, nextRetryAt = ?, errorMessage = ?, updatedAt = ?
         WHERE scheduleId = ?`,
        [
          newRetryCount,
          nextRetryAt.toISOString(),
          errorMessage,
          new Date().toISOString(),
          schedule.scheduleId,
        ],
      );
    }
  }
}
