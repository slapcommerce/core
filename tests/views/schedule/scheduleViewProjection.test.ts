import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { scheduleViewProjection } from "../../../src/views/schedule/scheduleViewProjection";
import {
  ScheduleCreatedEvent,
  ScheduleUpdatedEvent,
  ScheduleExecutedEvent,
  ScheduleFailedEvent,
  ScheduleCancelledEvent,
} from "../../../src/domain/schedule/events";
import { schemas } from "../../../src/infrastructure/schemas";
import { TransactionBatch } from "../../../src/infrastructure/transactionBatch";
import { ScheduleViewRepository } from "../../../src/infrastructure/repositories/scheduleViewRepository";

describe("scheduleViewProjection", () => {
  test("should handle schedule.created event", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batch = new TransactionBatch();
    const scheduleViewRepository = new ScheduleViewRepository(db, batch);

    const scheduleId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();
    const scheduledFor = new Date(Date.now() + 60000);

    const event = new ScheduleCreatedEvent({
      occurredAt: new Date(),
      aggregateId: scheduleId,
      correlationId: correlationId,
      version: 0,
      priorState: {} as any,
      newState: {
        targetAggregateId: targetAggregateId,
        targetAggregateType: "collection",
        commandType: "publishCollection",
        commandData: { expectedVersion: 1 },
        scheduledFor: scheduledFor,
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdBy: "user-123",
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Act
    await scheduleViewProjection(event, {
      scheduleViewRepository,
    } as any);

    // Flush the batch
    batch.resolve();
    db.run("BEGIN TRANSACTION");
    for (const cmd of batch.commands) {
      cmd.statement.run(...cmd.params);
    }
    db.run("COMMIT");

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.target_aggregate_id).toBe(targetAggregateId);
    expect(scheduleView.target_aggregate_type).toBe("collection");
    expect(scheduleView.command_type).toBe("publishCollection");
    expect(scheduleView.status).toBe("pending");
    expect(scheduleView.retry_count).toBe(0);
    expect(scheduleView.created_by).toBe("user-123");
  });

  test("should handle schedule.updated event", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const scheduleId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();
    const originalScheduledFor = new Date(Date.now() + 60000);
    const newScheduledFor = new Date(Date.now() + 120000);

    // Insert initial schedule
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scheduleId,
      targetAggregateId,
      "collection",
      "publishCollection",
      JSON.stringify({ expectedVersion: 1 }),
      originalScheduledFor.toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      correlationId,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const batch = new TransactionBatch();
    const scheduleViewRepository = new ScheduleViewRepository(db, batch);

    const event = new ScheduleUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: scheduleId,
      correlationId: correlationId,
      version: 1,
      priorState: {
        scheduledFor: originalScheduledFor,
        commandData: { expectedVersion: 1 },
      } as any,
      newState: {
        targetAggregateId: targetAggregateId,
        targetAggregateType: "collection",
        commandType: "publishCollection",
        commandData: { expectedVersion: 2 },
        scheduledFor: newScheduledFor,
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdBy: "user-123",
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Act
    await scheduleViewProjection(event, {
      scheduleViewRepository,
    } as any);

    // Flush the batch
    batch.resolve();
    db.run("BEGIN TRANSACTION");
    for (const cmd of batch.commands) {
      cmd.statement.run(...cmd.params);
    }
    db.run("COMMIT");

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(new Date(scheduleView.scheduled_for).getTime()).toBe(
      newScheduledFor.getTime(),
    );
    expect(JSON.parse(scheduleView.command_data).expectedVersion).toBe(2);
  });

  test("should handle schedule.executed event", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const scheduleId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();

    // Insert initial pending schedule
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scheduleId,
      targetAggregateId,
      "collection",
      "publishCollection",
      null,
      new Date(Date.now() + 60000).toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      correlationId,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const batch = new TransactionBatch();
    const scheduleViewRepository = new ScheduleViewRepository(db, batch);

    const event = new ScheduleExecutedEvent({
      occurredAt: new Date(),
      aggregateId: scheduleId,
      correlationId: correlationId,
      version: 1,
      priorState: { status: "pending" } as any,
      newState: {
        targetAggregateId: targetAggregateId,
        targetAggregateType: "collection",
        commandType: "publishCollection",
        commandData: null,
        scheduledFor: new Date(Date.now() + 60000),
        status: "executed",
        retryCount: 0,
        nextRetryAt: null,
        createdBy: "user-123",
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Act
    await scheduleViewProjection(event, {
      scheduleViewRepository,
    } as any);

    // Flush the batch
    batch.resolve();
    db.run("BEGIN TRANSACTION");
    for (const cmd of batch.commands) {
      cmd.statement.run(...cmd.params);
    }
    db.run("COMMIT");

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("executed");
  });

  test("should handle schedule.failed event with retry info", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const scheduleId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();
    const nextRetryAt = new Date(Date.now() + 120000);

    // Insert initial pending schedule
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scheduleId,
      targetAggregateId,
      "collection",
      "publishCollection",
      null,
      new Date(Date.now() + 60000).toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      correlationId,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const batch = new TransactionBatch();
    const scheduleViewRepository = new ScheduleViewRepository(db, batch);

    const event = new ScheduleFailedEvent({
      occurredAt: new Date(),
      aggregateId: scheduleId,
      correlationId: correlationId,
      version: 1,
      priorState: { status: "pending", retryCount: 0 } as any,
      newState: {
        targetAggregateId: targetAggregateId,
        targetAggregateType: "collection",
        commandType: "publishCollection",
        commandData: null,
        scheduledFor: new Date(Date.now() + 60000),
        status: "pending",
        retryCount: 1,
        nextRetryAt: nextRetryAt,
        createdBy: "user-123",
        errorMessage: "Connection timeout",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Act
    await scheduleViewProjection(event, {
      scheduleViewRepository,
    } as any);

    // Flush the batch
    batch.resolve();
    db.run("BEGIN TRANSACTION");
    for (const cmd of batch.commands) {
      cmd.statement.run(...cmd.params);
    }
    db.run("COMMIT");

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("pending"); // Still pending for retry
    expect(scheduleView.retry_count).toBe(1);
    expect(scheduleView.error_message).toBe("Connection timeout");
    expect(scheduleView.next_retry_at).not.toBeNull();
  });

  test("should handle schedule.cancelled event", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const scheduleId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();

    // Insert initial pending schedule
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scheduleId,
      targetAggregateId,
      "collection",
      "publishCollection",
      null,
      new Date(Date.now() + 60000).toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      correlationId,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const batch = new TransactionBatch();
    const scheduleViewRepository = new ScheduleViewRepository(db, batch);

    const event = new ScheduleCancelledEvent({
      occurredAt: new Date(),
      aggregateId: scheduleId,
      correlationId: correlationId,
      version: 1,
      priorState: { status: "pending" } as any,
      newState: {
        targetAggregateId: targetAggregateId,
        targetAggregateType: "collection",
        commandType: "publishCollection",
        commandData: null,
        scheduledFor: new Date(Date.now() + 60000),
        status: "cancelled",
        retryCount: 0,
        nextRetryAt: null,
        createdBy: "user-123",
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Act
    await scheduleViewProjection(event, {
      scheduleViewRepository,
    } as any);

    // Flush the batch
    batch.resolve();
    db.run("BEGIN TRANSACTION");
    for (const cmd of batch.commands) {
      cmd.statement.run(...cmd.params);
    }
    db.run("COMMIT");

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("cancelled");
  });
});
