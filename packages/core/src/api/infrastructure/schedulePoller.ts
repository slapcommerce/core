import type { Database } from "bun:sqlite";
import type { UnitOfWork } from "./unitOfWork";
import { ScheduleAggregate } from "../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";

export interface ScheduleCommandHandler {
  execute(payload: Record<string, unknown>): Promise<void>;
}

export interface SchedulePollerConfig {
  /** Time interval in milliseconds between polls (default: 5000ms) */
  pollIntervalMs?: number;
  /** Maximum number of retries before marking as permanently failed (default: 5) */
  maxRetries?: number;
  /** Number of schedules to fetch per poll (default: 100) */
  batchSize?: number;
}

export class SchedulePoller {
  private readonly db: Database;
  private readonly unitOfWork: UnitOfWork;
  private readonly config: Required<SchedulePollerConfig>;
  private readonly handlers: Map<string, ScheduleCommandHandler> = new Map();
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
   * Register a command handler for a specific command type.
   * Each command type can only have one handler.
   */
  registerCommandHandler(
    commandType: string,
    handler: ScheduleCommandHandler,
  ): void {
    this.handlers.set(commandType, handler);
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

  private fetchDueSchedules(): Array<{
    aggregateId: string;
    targetAggregateId: string;
    targetAggregateType: string;
    commandType: string;
    commandData: string | null;
    scheduledFor: string;
    status: string;
    retryCount: number;
    nextRetryAt: string | null;
    version: number;
    correlationId: string;
  }> {
    const now = new Date().toISOString();
    const query = this.db.query(
      `SELECT aggregateId, targetAggregateId, targetAggregateType, commandType,
              commandData, scheduledFor, status, retryCount, nextRetryAt, version, correlationId
       FROM schedulesReadModel
       WHERE status = 'pending'
         AND scheduledFor <= ?
         AND (nextRetryAt IS NULL OR nextRetryAt <= ?)
       ORDER BY scheduledFor ASC
       LIMIT ?`,
    );

    return query.all(now, now, this.config.batchSize) as Array<{
      aggregateId: string;
      targetAggregateId: string;
      targetAggregateType: string;
      commandType: string;
      commandData: string | null;
      scheduledFor: string;
      status: string;
      retryCount: number;
      nextRetryAt: string | null;
      version: number;
      correlationId: string;
    }>;
  }

  private async processSchedule(schedule: {
    aggregateId: string;
    targetAggregateId: string;
    targetAggregateType: string;
    commandType: string;
    commandData: string | null;
    version: number;
    correlationId: string;
  }): Promise<void> {
    const handler = this.handlers.get(schedule.commandType);
    if (!handler) {
      console.warn(
        `No handler registered for command type: ${schedule.commandType}. Schedule ID: ${schedule.aggregateId}`,
      );
      // Mark as failed since there's no handler to execute it
      // Use maxRetries = 0 to immediately mark as permanently failed
      await this.markScheduleFailed(
        schedule.aggregateId,
        schedule.version,
        schedule.correlationId,
        `No handler registered for command type: ${schedule.commandType}`,
        0, // No retries for missing handler
      );
      return;
    }

    try {
      // Build command payload with fresh id and correlationId
      const commandData = schedule.commandData
        ? JSON.parse(schedule.commandData)
        : {};
      const payload = {
        id: schedule.targetAggregateId,
        correlationId: randomUUIDv7(),
        userId: "system", // Automated system execution
        ...commandData,
      };

      // Execute the command handler
      await handler.execute(payload);

      // Mark schedule as executed
      await this.markScheduleExecuted(
        schedule.aggregateId,
        schedule.version,
        schedule.correlationId,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error executing schedule ${schedule.aggregateId}:`,
        errorMessage,
      );

      // Mark schedule as failed (with retry logic in aggregate)
      await this.markScheduleFailed(
        schedule.aggregateId,
        schedule.version,
        schedule.correlationId,
        errorMessage,
      );
    }
  }

  private async markScheduleExecuted(
    scheduleId: string,
    expectedVersion: number,
    correlationId: string,
  ): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load schedule aggregate
      const scheduleSnapshot = snapshotRepository.getSnapshot(scheduleId);
      if (!scheduleSnapshot) {
        throw new Error(`Schedule with id ${scheduleId} not found`);
      }

      // Check version for optimistic concurrency
      if (scheduleSnapshot.version !== expectedVersion) {
        console.warn(
          `Schedule ${scheduleId} version mismatch. Expected ${expectedVersion}, got ${scheduleSnapshot.version}. Skipping execution.`,
        );
        return;
      }

      const scheduleAggregate =
        ScheduleAggregate.loadFromSnapshot(scheduleSnapshot);

      // Mark as executed (using system user for automated execution)
      scheduleAggregate.markExecuted("system");

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save schedule snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: scheduleAggregate.id,
        correlationId: correlationId,
        version: scheduleAggregate.version,
        payload: scheduleAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of scheduleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }

  private async markScheduleFailed(
    scheduleId: string,
    expectedVersion: number,
    correlationId: string,
    errorMessage: string,
    maxRetries?: number,
  ): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load schedule aggregate
      const scheduleSnapshot = snapshotRepository.getSnapshot(scheduleId);
      if (!scheduleSnapshot) {
        throw new Error(`Schedule with id ${scheduleId} not found`);
      }

      // Check version for optimistic concurrency
      if (scheduleSnapshot.version !== expectedVersion) {
        console.warn(
          `Schedule ${scheduleId} version mismatch. Expected ${expectedVersion}, got ${scheduleSnapshot.version}. Skipping failure marking.`,
        );
        return;
      }

      const scheduleAggregate =
        ScheduleAggregate.loadFromSnapshot(scheduleSnapshot);

      // Mark as failed (aggregate handles retry logic, using system user for automated failure marking)
      scheduleAggregate.markFailed(
        errorMessage,
        "system",
        maxRetries ?? this.config.maxRetries,
      );

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save schedule snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: scheduleAggregate.id,
        correlationId: correlationId,
        version: scheduleAggregate.version,
        payload: scheduleAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of scheduleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
