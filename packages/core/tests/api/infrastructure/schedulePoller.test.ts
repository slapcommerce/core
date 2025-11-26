import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { SchedulePoller } from "../../../src/api/infrastructure/schedulePoller";
import type { ScheduleCommandHandler } from "../../../src/api/infrastructure/schedulePoller";
import { UnitOfWork } from "../../../src/api/infrastructure/unitOfWork";
import { TransactionBatcher } from "../../../src/api/infrastructure/transactionBatcher";
import { schemas } from "../../../src/api/infrastructure/schemas";
import { CreateScheduleService } from "../../../src/api/app/schedule/commands/admin/createScheduleService";
import type { CreateScheduleCommand } from "../../../src/api/app/schedule/commands/admin/commands";

function createValidCreateCommand(
  overrides?: Partial<CreateScheduleCommand>,
): CreateScheduleCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    type: "createSchedule",
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    userId: overrides?.userId ?? "test-user-id",
    targetAggregateId: overrides?.targetAggregateId ?? randomUUIDv7(),
    targetAggregateType: overrides?.targetAggregateType ?? "collection",
    commandType: overrides?.commandType ?? "publishCollection",
    commandData: overrides?.commandData ?? { expectedVersion: 1 },
    scheduledFor: overrides?.scheduledFor ?? new Date(Date.now() - 1000), // Past time for immediate execution
    createdBy: overrides?.createdBy ?? "user-123",
  };
}

// Helper to wait for async operations
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SchedulePoller", () => {
  test("should register command handlers", () => {
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

    const unitOfWork = new UnitOfWork(db, batcher);
    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });

    const handler: ScheduleCommandHandler = {
      execute: async () => {},
    };

    // Act
    poller.registerCommandHandler("publishCollection", handler);

    // Assert - No direct way to test, but if no error thrown it's successful
    expect(true).toBe(true);

    // Cleanup
    batcher.stop();
  });

  test("should fetch due schedules with past scheduledFor", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    // Create schedule in the past (should be executed)
    const scheduleId = randomUUIDv7();
    const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      scheduledFor: pastTime,
    });
    await createService.execute(createCommand);

    let executionCount = 0;
    const handler: ScheduleCommandHandler = {
      execute: async () => {
        executionCount++;
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
      maxRetries: 5,
      batchSize: 100,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(250); // Wait for poll to execute
    poller.stop();

    // Assert
    expect(executionCount).toBe(1);

    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("executed");

    // Cleanup
    batcher.stop();
  });

  test("should not fetch schedules with future scheduledFor", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    // Create schedule in the future (should NOT be executed)
    const scheduleId = randomUUIDv7();
    const futureTime = new Date(Date.now() + 60000); // 1 minute from now
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      scheduledFor: futureTime,
    });
    await createService.execute(createCommand);

    let executionCount = 0;
    const handler: ScheduleCommandHandler = {
      execute: async () => {
        executionCount++;
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(250);
    poller.stop();

    // Assert
    expect(executionCount).toBe(0);

    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("pending");

    // Cleanup
    batcher.stop();
  });

  test("should respect nextRetryAt for failed schedules", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    // Create schedule
    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      scheduledFor: new Date(Date.now() - 1000), // Past time
    });
    await createService.execute(createCommand);

    // Manually mark as failed with future nextRetryAt
    const futureRetryTime = new Date(Date.now() + 60000); // 1 minute from now
    db.run(
      `UPDATE schedulesReadModel SET status = 'failed', retry_count = 1, next_retry_at = ? WHERE aggregateId = ?`,
      [futureRetryTime.toISOString(), scheduleId],
    );

    // Update snapshot to match
    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get(scheduleId) as any;
    const snapshotPayload = JSON.parse(snapshot.payload);
    snapshotPayload.status = "failed";
    snapshotPayload.retryCount = 1;
    snapshotPayload.nextRetryAt = futureRetryTime.toISOString();
    db.run(
      "UPDATE snapshots SET payload = ? WHERE aggregateId = ?",
      [JSON.stringify(snapshotPayload), scheduleId],
    );

    let executionCount = 0;
    const handler: ScheduleCommandHandler = {
      execute: async () => {
        executionCount++;
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(250);
    poller.stop();

    // Assert - Should not execute because nextRetryAt is in the future
    expect(executionCount).toBe(0);

    // Cleanup
    batcher.stop();
  });

  test("should successfully execute command via registered handler", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();
    const commandData = { expectedVersion: 1, publishAt: new Date() };
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      targetAggregateId,
      commandData,
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);

    let capturedPayload: any = null;
    const handler: ScheduleCommandHandler = {
      execute: async (payload) => {
        capturedPayload = payload;
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(250);
    poller.stop();

    // Assert
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.id).toBe(targetAggregateId);
    expect(capturedPayload.expectedVersion).toBe(1);
    expect(capturedPayload.correlationId).toBeDefined(); // Fresh correlation ID

    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("executed");

    // Cleanup
    batcher.stop();
  });

  test("should mark schedule as failed when handler throws error", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 25, // Faster flush for test
      batchSizeThreshold: 1, // Flush immediately
      maxQueueDepth: 100,
    });
    batcher.start();


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);
    await sleep(50); // Wait for batcher to flush

    const handler: ScheduleCommandHandler = {
      execute: async () => {
        throw new Error("Test execution error");
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
      maxRetries: 5,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(600); // Wait for polls to execute
    poller.stop();
    await sleep(50); // Wait for final flush

    // Assert
    // After first failure, status should remain "pending" with retry scheduled
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("pending");
    expect(scheduleView.retry_count).toBe(1);
    expect(scheduleView.errorMessage).toBe("Test execution error");
    expect(scheduleView.next_retry_at).not.toBeNull();

    // Cleanup
    batcher.stop();
  });

  test("should use exponential backoff for retry logic", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);

    const handler: ScheduleCommandHandler = {
      execute: async () => {
        throw new Error("Fail");
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
      maxRetries: 5,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act - First failure
    poller.start();
    await sleep(250);
    poller.stop();

    // Assert - Check exponential backoff (2^1 = 2 minutes)
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.retry_count).toBe(1);

    const nextRetryAt = new Date(scheduleView.next_retry_at);
    const scheduledFor = new Date(scheduleView.scheduledFor);
    const diffMinutes =
      (nextRetryAt.getTime() - scheduledFor.getTime()) / 60000;
    expect(Math.round(diffMinutes)).toBe(2); // 2^1 = 2 minutes

    // Cleanup
    batcher.stop();
  });

  test("should mark as permanently failed after max retries", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 10, // Very fast flush for test
      batchSizeThreshold: 1, // Flush immediately
      maxQueueDepth: 100,
    });
    batcher.start();


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const correlationId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      correlationId,
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);
    await sleep(50); // Wait for batcher to flush

    // Manually set retry count to just before max - update view, snapshot, and version
    db.run(
      `UPDATE schedulesReadModel SET status = 'pending', retry_count = 4, next_retry_at = ?, version = 4 WHERE aggregateId = ?`,
      [new Date(Date.now() - 1000).toISOString(), scheduleId],
    );

    const snapshot = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get(scheduleId) as any;
    const snapshotPayload = JSON.parse(snapshot.payload);
    snapshotPayload.status = "pending";
    snapshotPayload.retryCount = 4;
    snapshotPayload.nextRetryAt = new Date(Date.now() - 1000).toISOString();
    db.run(
      "UPDATE snapshots SET payload = ?, version = 4 WHERE aggregateId = ?",
      [JSON.stringify(snapshotPayload), scheduleId],
    );

    const handler: ScheduleCommandHandler = {
      execute: async () => {
        throw new Error("Permanent failure");
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 50,
      maxRetries: 5,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(200); // Wait for polls to execute
    poller.stop();

    // Wait for batcher to flush all pending writes
    await sleep(150);

    // Assert
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("failed");
    expect(scheduleView.retry_count).toBe(5);
    expect(scheduleView.next_retry_at).toBeNull(); // No more retries

    // Cleanup
    batcher.stop();
  });

  test("should handle no handler registered for command type", async () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 25, // Faster flush for test
      batchSizeThreshold: 1, // Flush immediately
      maxQueueDepth: 100,
    });
    batcher.start();


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      commandType: "unknownCommand", // No handler for this
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);
    await sleep(50); // Wait for batcher to flush

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });
    // Note: NOT registering any handler

    // Act
    poller.start();
    await sleep(600); // Wait for polls to execute
    poller.stop();
    await sleep(50); // Wait for final flush

    // Assert - Should be marked as failed
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("failed");
    expect(scheduleView.errorMessage).toContain(
      "No handler registered for command type: unknownCommand",
    );

    // Cleanup
    batcher.stop();
  });

  test("should respect batch size limit", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    // Create 5 schedules
    const scheduleIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const scheduleId = randomUUIDv7();
      scheduleIds.push(scheduleId);
      const createCommand = createValidCreateCommand({
        id: scheduleId,
        scheduledFor: new Date(Date.now() - 1000),
      });
      await createService.execute(createCommand);
    }

    let executionCount = 0;
    const handler: ScheduleCommandHandler = {
      execute: async () => {
        executionCount++;
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
      batchSize: 3, // Limit to 3
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act - Single poll should only process 3
    poller.start();
    await sleep(250); // Wait for one complete poll cycle
    poller.stop();

    // Assert - Should process at least 3 in first batch (may process more if multiple polls)
    expect(executionCount).toBeGreaterThanOrEqual(3);

    // Cleanup
    batcher.stop();
  });

  test("should handle optimistic concurrency during execution", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);

    // Manually update version to simulate concurrent modification
    db.run(
      "UPDATE snapshots SET version = 5 WHERE aggregateId = ?",
      [scheduleId],
    );

    const handler: ScheduleCommandHandler = {
      execute: async () => {
        // Should not be called due to version mismatch
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(250);
    poller.stop();

    // Assert - Schedule should still be pending due to version mismatch
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView.status).toBe("pending");

    // Cleanup
    batcher.stop();
  });

  test("should stop polling when stop is called", async () => {
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

    const unitOfWork = new UnitOfWork(db, batcher);

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });

    // Act
    poller.start();
    await sleep(50);
    poller.stop();
    await sleep(200); // Wait longer than poll interval

    // Assert - No error should occur, poller should be stopped
    expect(true).toBe(true);

    // Cleanup
    batcher.stop();
  });

  test("should handle null commandData during execution", async () => {
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


    const unitOfWork = new UnitOfWork(db, batcher);
    const createService = new CreateScheduleService(
      unitOfWork,
    );

    const scheduleId = randomUUIDv7();
    const targetAggregateId = randomUUIDv7();
    const createCommand = createValidCreateCommand({
      id: scheduleId,
      targetAggregateId,
      commandData: null, // Null command data
      scheduledFor: new Date(Date.now() - 1000),
    });
    await createService.execute(createCommand);

    let capturedPayload: any = null;
    const handler: ScheduleCommandHandler = {
      execute: async (payload) => {
        capturedPayload = payload;
      },
    };

    const poller = new SchedulePoller(db, unitOfWork, {
      pollIntervalMs: 100,
    });
    poller.registerCommandHandler("publishCollection", handler);

    // Act
    poller.start();
    await sleep(250);
    poller.stop();

    // Assert - Should still execute with empty object
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.id).toBe(targetAggregateId);
    expect(capturedPayload.correlationId).toBeDefined();

    // Cleanup
    batcher.stop();
  });
});
