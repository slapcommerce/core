import type { Database } from "bun:sqlite";
import type { UnitOfWork } from "./unitOfWork";
import type { ProjectionService } from "./projectionService";
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
  private readonly projectionService: ProjectionService;
  private readonly config: Required<SchedulePollerConfig>;
  private readonly handlers: Map<string, ScheduleCommandHandler> = new Map();
  private isRunning = false;
  private pollTimer: Timer | null = null;

  constructor(
    db: Database,
    unitOfWork: UnitOfWork,
    projectionService: ProjectionService,
    config?: SchedulePollerConfig,
  ) {
    this.db = db;
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
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
          console.error("Error in schedule poll:", error);
        })
        .finally(() => {
          this.scheduleNextPoll();
        });
    }, this.config.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    const dueSchedules = this.fetchDueSchedules();
    if (dueSchedules.length === 0) return;

    for (const schedule of dueSchedules) {
      await this.processSchedule(schedule);
    }
  }

  private fetchDueSchedules(): Array<{
    aggregate_id: string;
    target_aggregate_id: string;
    target_aggregate_type: string;
    command_type: string;
    command_data: string | null;
    scheduled_for: string;
    status: string;
    retry_count: number;
    next_retry_at: string | null;
    version: number;
    correlation_id: string;
  }> {
    const now = new Date().toISOString();
    const query = this.db.query(
      `SELECT aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
              command_data, scheduled_for, status, retry_count, next_retry_at, version, correlation_id
       FROM schedules_view
       WHERE status = 'pending'
         AND scheduled_for <= ?
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY scheduled_for ASC
       LIMIT ?`,
    );

    return query.all(now, now, this.config.batchSize) as Array<{
      aggregate_id: string;
      target_aggregate_id: string;
      target_aggregate_type: string;
      command_type: string;
      command_data: string | null;
      scheduled_for: string;
      status: string;
      retry_count: number;
      next_retry_at: string | null;
      version: number;
      correlation_id: string;
    }>;
  }

  private async processSchedule(schedule: {
    aggregate_id: string;
    target_aggregate_id: string;
    target_aggregate_type: string;
    command_type: string;
    command_data: string | null;
    version: number;
    correlation_id: string;
  }): Promise<void> {
    const handler = this.handlers.get(schedule.command_type);
    if (!handler) {
      console.warn(
        `No handler registered for command type: ${schedule.command_type}. Schedule ID: ${schedule.aggregate_id}`,
      );
      // Mark as failed since there's no handler to execute it
      // Use maxRetries = 0 to immediately mark as permanently failed
      await this.markScheduleFailed(
        schedule.aggregate_id,
        schedule.version,
        schedule.correlation_id,
        `No handler registered for command type: ${schedule.command_type}`,
        0, // No retries for missing handler
      );
      return;
    }

    try {
      // Build command payload with fresh id and correlationId
      const commandData = schedule.command_data
        ? JSON.parse(schedule.command_data)
        : {};
      const payload = {
        id: schedule.target_aggregate_id,
        correlationId: randomUUIDv7(),
        ...commandData,
      };

      // Execute the command handler
      await handler.execute(payload);

      // Mark schedule as executed
      await this.markScheduleExecuted(
        schedule.aggregate_id,
        schedule.version,
        schedule.correlation_id,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error executing schedule ${schedule.aggregate_id}:`,
        errorMessage,
      );

      // Mark schedule as failed (with retry logic in aggregate)
      await this.markScheduleFailed(
        schedule.aggregate_id,
        schedule.version,
        schedule.correlation_id,
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

      // Mark as executed
      scheduleAggregate.markExecuted();

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Save schedule snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: scheduleAggregate.id,
        correlation_id: correlationId,
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

      // Mark as failed (aggregate handles retry logic)
      scheduleAggregate.markFailed(
        errorMessage,
        maxRetries ?? this.config.maxRetries,
      );

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Save schedule snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: scheduleAggregate.id,
        correlation_id: correlationId,
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
