import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { CancelScheduleService } from "../../../src/app/schedule/cancelScheduleService";
import { CreateScheduleService } from "../../../src/app/schedule/createScheduleService";
import { UnitOfWork } from "../../../src/infrastructure/unitOfWork";
import { TransactionBatcher } from "../../../src/infrastructure/transactionBatcher";
import { schemas } from "../../../src/infrastructure/schemas";
import { ProjectionService } from "../../../src/infrastructure/projectionService";
import { scheduleViewProjection } from "../../../src/views/schedule/scheduleViewProjection";
import type {
  CreateScheduleCommand,
  CancelScheduleCommand,
} from "../../../src/app/schedule/commands";

function createValidCreateCommand(
  overrides?: Partial<CreateScheduleCommand>,
): CreateScheduleCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    targetAggregateId: overrides?.targetAggregateId ?? randomUUIDv7(),
    targetAggregateType: overrides?.targetAggregateType ?? "collection",
    commandType: overrides?.commandType ?? "publishCollection",
    commandData: overrides?.commandData ?? { expectedVersion: 1 },
    scheduledFor: overrides?.scheduledFor ?? new Date(Date.now() + 60000),
    createdBy: overrides?.createdBy ?? "user-123",
  };
}

describe("CancelScheduleService", () => {
  test("should successfully cancel pending schedule", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100,
    });
    batcher.start();

    const projectionService = new ProjectionService();
    projectionService.registerHandler(
      "schedule.created",
      scheduleViewProjection,
    );
    projectionService.registerHandler(
      "schedule.cancelled",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const cancelService = new CancelScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create initial schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    const cancelCommand: CancelScheduleCommand = {
      id: scheduleId,
      expectedVersion: 0,
    };

    // Act
    await cancelService.execute(cancelCommand);

    // Assert - Verify cancelled event was saved
    const cancelledEvent = db
      .query(
        "SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'schedule.cancelled'",
      )
      .get(scheduleId) as any;
    expect(cancelledEvent).toBeDefined();
    expect(cancelledEvent.version).toBe(1);

    const eventPayload = JSON.parse(cancelledEvent.payload);
    expect(eventPayload.newState.status).toBe("cancelled");

    // Assert - Verify snapshot was updated
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(snapshot).toBeDefined();
    expect(snapshot.version).toBe(1);

    const snapshotPayload = JSON.parse(snapshot.payload);
    expect(snapshotPayload.status).toBe("cancelled");

    // Assert - Verify projection was applied
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("cancelled");

    // Cleanup
    batcher.stop();
  });

  test("should successfully cancel failed schedule", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100,
    });
    batcher.start();

    const projectionService = new ProjectionService();
    projectionService.registerHandler(
      "schedule.created",
      scheduleViewProjection,
    );
    projectionService.registerHandler(
      "schedule.cancelled",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const cancelService = new CancelScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    // Manually mark as failed by updating the snapshot
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    const snapshotPayload = JSON.parse(snapshot.payload);
    snapshotPayload.status = "failed";
    snapshotPayload.retryCount = 2;
    snapshotPayload.errorMessage = "Test error";
    db.run(
      "UPDATE snapshots SET payload = ? WHERE aggregate_id = ?",
      JSON.stringify(snapshotPayload),
      scheduleId,
    );

    const cancelCommand: CancelScheduleCommand = {
      id: scheduleId,
      expectedVersion: 0,
    };

    // Act
    await cancelService.execute(cancelCommand);

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("cancelled");

    // Cleanup
    batcher.stop();
  });

  test("should throw error when schedule not found", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100,
    });
    batcher.start();

    const projectionService = new ProjectionService();
    const unitOfWork = new UnitOfWork(db, batcher);
    const cancelService = new CancelScheduleService(
      unitOfWork,
      projectionService,
    );

    const nonExistentId = randomUUIDv7();
    const cancelCommand: CancelScheduleCommand = {
      id: nonExistentId,
      expectedVersion: 0,
    };

    // Act & Assert
    await expect(cancelService.execute(cancelCommand)).rejects.toThrow(
      `Schedule with id ${nonExistentId} not found`,
    );

    // Cleanup
    batcher.stop();
  });

  test("should throw error on optimistic concurrency conflict", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100,
    });
    batcher.start();

    const projectionService = new ProjectionService();
    projectionService.registerHandler(
      "schedule.created",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const cancelService = new CancelScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create initial schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    // Try to cancel with wrong version
    const cancelCommand: CancelScheduleCommand = {
      id: scheduleId,
      expectedVersion: 3, // Wrong version - actual is 0
    };

    // Act & Assert
    await expect(cancelService.execute(cancelCommand)).rejects.toThrow(
      "Optimistic concurrency conflict: expected version 3 but found version 0",
    );

    // Cleanup
    batcher.stop();
  });

  test("should throw error when trying to cancel executed schedule", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100,
    });
    batcher.start();

    const projectionService = new ProjectionService();
    projectionService.registerHandler(
      "schedule.created",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const cancelService = new CancelScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    // Manually mark as executed by updating the snapshot
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    const snapshotPayload = JSON.parse(snapshot.payload);
    snapshotPayload.status = "executed";
    db.run(
      "UPDATE snapshots SET payload = ? WHERE aggregate_id = ?",
      JSON.stringify(snapshotPayload),
      scheduleId,
    );

    const cancelCommand: CancelScheduleCommand = {
      id: scheduleId,
      expectedVersion: 0,
    };

    // Act & Assert
    await expect(cancelService.execute(cancelCommand)).rejects.toThrow(
      "Cannot cancel an already executed schedule",
    );

    // Cleanup
    batcher.stop();
  });

  test("should throw error when trying to cancel already cancelled schedule", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100,
    });
    batcher.start();

    const projectionService = new ProjectionService();
    projectionService.registerHandler(
      "schedule.created",
      scheduleViewProjection,
    );
    projectionService.registerHandler(
      "schedule.cancelled",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const cancelService = new CancelScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    // Cancel once
    const cancelCommand: CancelScheduleCommand = {
      id: scheduleId,
      expectedVersion: 0,
    };
    await cancelService.execute(cancelCommand);

    // Try to cancel again
    const cancelCommandAgain: CancelScheduleCommand = {
      id: scheduleId,
      expectedVersion: 1,
    };

    // Act & Assert
    await expect(cancelService.execute(cancelCommandAgain)).rejects.toThrow(
      "Schedule is already cancelled",
    );

    // Cleanup
    batcher.stop();
  });
});
