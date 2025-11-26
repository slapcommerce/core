import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { schemas } from "../../src/api/infrastructure/schemas";
import { TransactionBatcher } from "../../src/api/infrastructure/transactionBatcher";
import { UnitOfWork } from "../../src/api/infrastructure/unitOfWork";
import { SchedulePoller } from "../../src/api/infrastructure/schedulePoller";
import { CreateCollectionService } from "../../src/api/app/collection/commands/admin/createCollectionService";
import { PublishCollectionService } from "../../src/api/app/collection/commands/admin/publishCollectionService";
import { CreateScheduleService } from "../../src/api/app/schedule/commands/admin/createScheduleService";

/**
 * E2E Test: Schedule Execution Flow
 *
 * This test verifies the complete scheduling system by:
 * 1. Creating a collection in draft status
 * 2. Scheduling a publishCollection command for near-future execution
 * 3. Starting the SchedulePoller
 * 4. Waiting for the schedule to execute
 * 5. Verifying the collection was published
 * 6. Verifying the schedule status changed to "executed"
 */
describe("Schedule Execution E2E", () => {
  test("should execute scheduled publishCollection command and publish the collection", async () => {
    // Arrange - Setup database and infrastructure
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

    // Register projections
    const collectionEvents = [
      "collection.created",
      "collection.archived",
      "collection.metadata_updated",
      "collection.published",
      "collection.seo_metadata_updated",
      "collection.unpublished",
      "collection.image_updated",
    ];

    // Arrange - Create services
    const createCollectionService = new CreateCollectionService(
      unitOfWork,
    );
    const publishCollectionService = new PublishCollectionService(
      unitOfWork,
    );
    const createScheduleService = new CreateScheduleService(
      unitOfWork,
    );

    // Arrange - Setup SchedulePoller
    const schedulePoller = new SchedulePoller(
      db,
      unitOfWork,
      {
        pollIntervalMs: 500, // Poll every 500ms for faster test execution
        maxRetries: 5,
        batchSize: 100,
      },
    );

    schedulePoller.registerCommandHandler(
      "publishCollection",
      publishCollectionService,
    );

    // Arrange - Create a draft collection
    const collectionId = randomUUIDv7();
    const collectionCorrelationId = randomUUIDv7();
    await createCollectionService.execute({
      id: collectionId,
      correlationId: collectionCorrelationId,
      userId: "test-user-id",
      name: "Test Collection",
      description: "A test collection for E2E scheduling",
      slug: `test-collection-${collectionId}`,
      type: "createCollection",
    });

    // Verify collection is in draft status
    let collectionView = db
      .query("SELECT * FROM collectionsReadModel WHERE aggregateId = ?")
      .get(collectionId) as any;
    expect(collectionView).toBeDefined();
    expect(collectionView.status).toBe("draft");
    expect(collectionView.publishedAt).toBeNull();

    // Arrange - Schedule publishCollection for 2 seconds in the future
    const scheduleId = randomUUIDv7();
    const scheduleCorrelationId = randomUUIDv7();
    const scheduledFor = new Date(Date.now() + 2000); // 2 seconds

    await createScheduleService.execute({
      id: scheduleId,
      correlationId: scheduleCorrelationId,
      userId: "test-user-id",
      targetAggregateId: collectionId,
      targetAggregateType: "collection",
      commandType: "publishCollection",
      commandData: { expectedVersion: 0 }, // Collection is at version 0 after creation
      scheduledFor: scheduledFor,
      createdBy: "test-user",
      type: "createSchedule",
    });

    // Verify schedule was created in pending status
    let scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("pending");
    expect(scheduleView.commandType).toBe("publishCollection");

    // Act - Start the poller
    schedulePoller.start();

    // Wait for 3 seconds to allow the schedule to be executed
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Assert - Verify schedule status changed to "executed"
    scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("executed");

    // Assert - Verify collection was published
    collectionView = db
      .query("SELECT * FROM collectionsReadModel WHERE aggregateId = ?")
      .get(collectionId) as any;
    expect(collectionView).toBeDefined();
    expect(collectionView.status).toBe("active");
    expect(collectionView.publishedAt).not.toBeNull();

    // Assert - Verify collection version was incremented
    const collectionSnapshot = db
      .query("SELECT * FROM snapshots WHERE aggregateId = ?")
      .get(collectionId) as any;
    expect(collectionSnapshot.version).toBe(1); // Incremented from 0 to 1 after publish

    // Assert - Verify schedule execution event was created
    const scheduleEvents_db = db
      .query("SELECT * FROM events WHERE aggregateId = ? ORDER BY version ASC")
      .all(scheduleId) as any[];
    expect(scheduleEvents_db.length).toBe(2); // created + executed
    expect(scheduleEvents_db[0].eventType).toBe("schedule.created");
    expect(scheduleEvents_db[1].eventType).toBe("schedule.executed");

    // Cleanup
    schedulePoller.stop();
    batcher.stop();
  });

  test("should handle scheduled command failure with retry", async () => {
    // Arrange - Setup database and infrastructure
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

    const scheduleEvents = [
      "schedule.created",
      "schedule.updated",
      "schedule.executed",
      "schedule.failed",
      "schedule.cancelled",
    ];

    const createScheduleService = new CreateScheduleService(
      unitOfWork,
    );

    // Arrange - Setup SchedulePoller WITHOUT registering a handler
    // This will cause the schedule to fail
    const schedulePoller = new SchedulePoller(
      db,
      unitOfWork,
      {
        pollIntervalMs: 500,
        maxRetries: 5,
        batchSize: 100,
      },
    );

    // Arrange - Schedule a command that will fail (no handler)
    const scheduleId = randomUUIDv7();
    const scheduleCorrelationId = randomUUIDv7();
    const scheduledFor = new Date(Date.now() + 1000); // 1 second

    await createScheduleService.execute({
      id: scheduleId,
      correlationId: scheduleCorrelationId,
      userId: "test-user-id",
      targetAggregateId: randomUUIDv7(),
      targetAggregateType: "collection",
      commandType: "publishCollection",
      commandData: null,
      scheduledFor: scheduledFor,
      createdBy: "test-user",
      type: "createSchedule",
    });

    // Act - Start the poller
    schedulePoller.start();

    // Wait for 2 seconds to allow the schedule to fail
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Assert - Verify schedule failed (no retries for missing handler)
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("failed"); // Failed immediately since no handler exists
    expect(scheduleView.retryCount).toBe(1);
    expect(scheduleView.errorMessage).toContain("No handler registered");
    expect(scheduleView.nextRetryAt).toBeNull(); // No retry for missing handler

    // Assert - Verify schedule.failed event was created
    const scheduleEvents_db = db
      .query(
        "SELECT * FROM events WHERE aggregateId = ? AND eventType = 'schedule.failed'",
      )
      .all(scheduleId) as any[];
    expect(scheduleEvents_db.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    schedulePoller.stop();
    batcher.stop();
  });

  test("should not execute schedule before scheduledFor time", async () => {
    // Arrange - Setup database and infrastructure
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

    const scheduleEvents = [
      "schedule.created",
      "schedule.updated",
      "schedule.executed",
      "schedule.failed",
      "schedule.cancelled",
    ];

    const createScheduleService = new CreateScheduleService(
      unitOfWork,
    );
    const publishCollectionService = new PublishCollectionService(
      unitOfWork,
    );

    const schedulePoller = new SchedulePoller(
      db,
      unitOfWork,
      {
        pollIntervalMs: 500,
        maxRetries: 5,
        batchSize: 100,
      },
    );

    schedulePoller.registerCommandHandler(
      "publishCollection",
      publishCollectionService,
    );

    // Arrange - Schedule a command for 10 seconds in the future
    const scheduleId = randomUUIDv7();
    const scheduleCorrelationId = randomUUIDv7();
    const scheduledFor = new Date(Date.now() + 10000); // 10 seconds

    await createScheduleService.execute({
      id: scheduleId,
      correlationId: scheduleCorrelationId,
      userId: "test-user-id",
      targetAggregateId: randomUUIDv7(),
      targetAggregateType: "collection",
      commandType: "publishCollection",
      commandData: null,
      scheduledFor: scheduledFor,
      createdBy: "test-user",
      type: "createSchedule",
    });

    // Act - Start the poller
    schedulePoller.start();

    // Wait for 2 seconds (should NOT execute yet)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Assert - Verify schedule is still pending (not executed)
    const scheduleView = db
      .query("SELECT * FROM schedulesReadModel WHERE aggregateId = ?")
      .get(scheduleId) as any;
    expect(scheduleView).toBeDefined();
    expect(scheduleView.status).toBe("pending");

    // Assert - Only creation event should exist
    const scheduleEvents_db = db
      .query("SELECT * FROM events WHERE aggregateId = ?")
      .all(scheduleId) as any[];
    expect(scheduleEvents_db.length).toBe(1);
    expect(scheduleEvents_db[0].eventType).toBe("schedule.created");

    // Cleanup
    schedulePoller.stop();
    batcher.stop();
  });
});
