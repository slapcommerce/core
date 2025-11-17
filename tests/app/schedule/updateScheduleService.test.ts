import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { UpdateScheduleService } from "../../../src/app/schedule/updateScheduleService";
import { CreateScheduleService } from "../../../src/app/schedule/createScheduleService";
import { UnitOfWork } from "../../../src/infrastructure/unitOfWork";
import { TransactionBatcher } from "../../../src/infrastructure/transactionBatcher";
import { schemas } from "../../../src/infrastructure/schemas";
import { ProjectionService } from "../../../src/infrastructure/projectionService";
import { scheduleViewProjection } from "../../../src/views/schedule/scheduleViewProjection";
import type {
  CreateScheduleCommand,
  UpdateScheduleCommand,
} from "../../../src/app/schedule/commands";

function createValidCreateCommand(
  overrides?: Partial<CreateScheduleCommand>,
): CreateScheduleCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? randomUUIDv7(),
    targetAggregateId: overrides?.targetAggregateId ?? randomUUIDv7(),
    targetAggregateType: overrides?.targetAggregateType ?? "collection",
    commandType: overrides?.commandType ?? "publishCollection",
    commandData: overrides?.commandData ?? { expectedVersion: 1 },
    scheduledFor: overrides?.scheduledFor ?? new Date(Date.now() + 60000),
    createdBy: overrides?.createdBy ?? "user-123",
  };
}

describe("UpdateScheduleService", () => {
  test("should successfully update schedule with new scheduledFor and commandData", async () => {
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
      "schedule.updated",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const updateService = new UpdateScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create initial schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    // Prepare update
    const newScheduledFor = new Date(Date.now() + 120000); // 2 minutes later
    const newCommandData = { expectedVersion: 2 };
    const updateCommand: UpdateScheduleCommand = {
      id: scheduleId,
      userId: randomUUIDv7(),
      scheduledFor: newScheduledFor,
      commandData: newCommandData,
      expectedVersion: 0,
    };

    // Act
    await updateService.execute(updateCommand);

    // Assert - Verify updated event was saved
    const updatedEvent = db
      .query(
        "SELECT * FROM events WHERE aggregate_id = ? AND event_type = 'schedule.updated'",
      )
      .get(scheduleId) as any;
    expect(updatedEvent).toBeDefined();
    expect(updatedEvent.version).toBe(1);

    const eventPayload = JSON.parse(updatedEvent.payload);
    expect(eventPayload.newState.scheduledFor).toBe(
      newScheduledFor.toISOString(),
    );
    expect(eventPayload.newState.commandData).toEqual(newCommandData);

    // Assert - Verify snapshot was updated
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(snapshot).toBeDefined();
    expect(snapshot.version).toBe(1);

    const snapshotPayload = JSON.parse(snapshot.payload);
    expect(snapshotPayload.scheduledFor).toBe(newScheduledFor.toISOString());
    expect(snapshotPayload.commandData).toEqual(newCommandData);

    // Assert - Verify projection was applied
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(new Date(scheduleView.scheduled_for).getTime()).toBe(
      newScheduledFor.getTime(),
    );
    expect(JSON.parse(scheduleView.command_data)).toEqual(newCommandData);

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
    const updateService = new UpdateScheduleService(
      unitOfWork,
      projectionService,
    );

    const nonExistentId = randomUUIDv7();
    const updateCommand: UpdateScheduleCommand = {
      id: nonExistentId,
      userId: randomUUIDv7(),
      scheduledFor: new Date(Date.now() + 120000),
      commandData: { expectedVersion: 1 },
      expectedVersion: 0,
    };

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow(
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
    const updateService = new UpdateScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create initial schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({ id: scheduleId });
    await createService.execute(createCommand);

    // Try to update with wrong version
    const updateCommand: UpdateScheduleCommand = {
      id: scheduleId,
      userId: randomUUIDv7(),
      scheduledFor: new Date(Date.now() + 120000),
      commandData: { expectedVersion: 1 },
      expectedVersion: 5, // Wrong version - actual is 0
    };

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow(
      "Optimistic concurrency conflict: expected version 5 but found version 0",
    );

    // Cleanup
    batcher.stop();
  });

  test("should throw error when trying to update non-pending schedule", async () => {
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
      "schedule.executed",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const updateService = new UpdateScheduleService(
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
      [JSON.stringify(snapshotPayload), scheduleId],
    );

    // Try to update executed schedule
    const updateCommand: UpdateScheduleCommand = {
      id: scheduleId,
      userId: randomUUIDv7(),
      scheduledFor: new Date(Date.now() + 120000),
      commandData: { expectedVersion: 1 },
      expectedVersion: 0,
    };

    // Act & Assert
    await expect(updateService.execute(updateCommand)).rejects.toThrow(
      "Cannot update schedule with status executed. Only pending schedules can be updated.",
    );

    // Cleanup
    batcher.stop();
  });

  test("should update schedule with null commandData", async () => {
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
      "schedule.updated",
      scheduleViewProjection,
    );

    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
      projectionService,
    );
    const updateService = new UpdateScheduleService(
      unitOfWork,
      projectionService,
    );

    // Create initial schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      commandData: { test: "data" },
    });
    await createService.execute(createCommand);

    // Update to null commandData
    const updateCommand: UpdateScheduleCommand = {
      id: scheduleId,
      userId: randomUUIDv7(),
      scheduledFor: new Date(Date.now() + 120000),
      commandData: null,
      expectedVersion: 0,
    };

    // Act
    await updateService.execute(updateCommand);

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.command_data).toBeNull();

    // Cleanup
    batcher.stop();
  });
});
