import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { CreateScheduleService } from "../../../src/app/schedule/createScheduleService";
import { UnitOfWork } from "../../../src/infrastructure/unitOfWork";
import { TransactionBatcher } from "../../../src/infrastructure/transactionBatcher";
import { schemas } from "../../../src/infrastructure/schemas";
import { ProjectionService } from "../../../src/infrastructure/projectionService";
import { scheduleViewProjection } from "../../../src/views/schedule/scheduleViewProjection";
import type { CreateScheduleCommand } from "../../../src/app/schedule/commands";

function createValidCommand(
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

describe("CreateScheduleService", () => {
  test("should successfully create a schedule with all required data", async () => {
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
    const service = new CreateScheduleService(unitOfWork, projectionService);
    const command = createValidCommand();

    // Act
    await service.execute(command);

    // Assert - Verify event was saved
    const event = db
      .query("SELECT * FROM events WHERE aggregate_id = ?")
      .get(command.id) as any;
    expect(event).toBeDefined();
    expect(event.event_type).toBe("schedule.created");
    expect(event.aggregate_id).toBe(command.id);
    expect(event.correlation_id).toBe(command.correlationId);
    expect(event.version).toBe(0);

    const eventPayload = JSON.parse(event.payload);
    expect(eventPayload.newState.targetAggregateId).toBe(
      command.targetAggregateId,
    );
    expect(eventPayload.newState.commandType).toBe(command.commandType);
    expect(eventPayload.newState.status).toBe("pending");
    expect(eventPayload.newState.retryCount).toBe(0);

    // Assert - Verify snapshot was saved
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregate_id = ?")
      .get(command.id) as any;
    expect(snapshot).toBeDefined();
    expect(snapshot.aggregate_id).toBe(command.id);
    expect(snapshot.correlation_id).toBe(command.correlationId);
    expect(snapshot.version).toBe(0);

    const snapshotPayload = JSON.parse(snapshot.payload);
    expect(snapshotPayload.targetAggregateId).toBe(command.targetAggregateId);
    expect(snapshotPayload.commandType).toBe(command.commandType);
    expect(snapshotPayload.status).toBe("pending");

    // Assert - Verify outbox event was created
    const outboxEvent = db
      .query("SELECT * FROM outbox WHERE aggregate_id = ?")
      .get(command.id) as any;
    expect(outboxEvent).toBeDefined();
    expect(outboxEvent.event_type).toBe("schedule.created");

    // Assert - Verify projection was applied
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(command.id) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.target_aggregate_id).toBe(command.targetAggregateId);
    expect(scheduleView.command_type).toBe(command.commandType);
    expect(scheduleView.status).toBe("pending");
    expect(scheduleView.created_by).toBe(command.createdBy);

    // Cleanup
    batcher.stop();
  });

  test("should create schedule with null commandData", async () => {
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
    const service = new CreateScheduleService(unitOfWork, projectionService);

    // Create command with explicitly null commandData
    const command: CreateScheduleCommand = {
      id: randomUUIDv7(),
      correlationId: randomUUIDv7(),
      userId: randomUUIDv7(),
      targetAggregateId: randomUUIDv7(),
      targetAggregateType: "collection",
      commandType: "publishCollection",
      commandData: null,
      scheduledFor: new Date(Date.now() + 60000),
      createdBy: "user-123",
    };

    // Act
    await service.execute(command);

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(command.id) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.command_data).toBeNull();

    // Cleanup
    batcher.stop();
  });

  test("should create schedule for different command types", async () => {
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
    const service = new CreateScheduleService(unitOfWork, projectionService);

    // Act - Create schedules for different commands
    const command1 = createValidCommand({
      commandType: "publishProduct",
      targetAggregateType: "product",
    });
    const command2 = createValidCommand({
      commandType: "unpublishCollection",
      targetAggregateType: "collection",
    });

    await service.execute(command1);
    await service.execute(command2);

    // Assert
    const schedule1 = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(command1.id) as any;
    expect(schedule1.command_type).toBe("publishProduct");
    expect(schedule1.target_aggregate_type).toBe("product");

    const schedule2 = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(command2.id) as any;
    expect(schedule2.command_type).toBe("unpublishCollection");
    expect(schedule2.target_aggregate_type).toBe("collection");

    // Cleanup
    batcher.stop();
  });

  test("should create schedule with future date", async () => {
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
    const service = new CreateScheduleService(unitOfWork, projectionService);

    const futureDate = new Date(Date.now() + 3600000); // 1 hour
    const command = createValidCommand({ scheduledFor: futureDate });

    // Act
    await service.execute(command);

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedules_view WHERE aggregate_id = ?")
      .get(command.id) as any;
    expect(scheduleView).toBeDefined();
    expect(new Date(scheduleView.scheduled_for).getTime()).toBe(
      futureDate.getTime(),
    );

    // Cleanup
    batcher.stop();
  });
});
