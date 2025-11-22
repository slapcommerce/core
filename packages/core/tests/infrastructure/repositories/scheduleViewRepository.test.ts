import { describe, test, expect } from "bun:test";
import { randomUUIDv7 } from "bun";
import { ScheduleViewRepository } from "../../../src/infrastructure/repositories/scheduleViewRepository";
import type { ScheduleViewData } from "../../../src/infrastructure/repositories/scheduleViewRepository";
import { TransactionBatch } from "../../../src/infrastructure/transactionBatch";
import { createTestDatabase, closeTestDatabase } from "../../helpers/database";

function createValidScheduleViewData(
  overrides?: Partial<ScheduleViewData>,
): ScheduleViewData {
  const now = new Date();
  return {
    aggregate_id: overrides?.aggregate_id ?? randomUUIDv7(),
    target_aggregate_id: overrides?.target_aggregate_id ?? randomUUIDv7(),
    target_aggregate_type: overrides?.target_aggregate_type ?? "collection",
    command_type: overrides?.command_type ?? "publishCollection",
    command_data: overrides?.command_data ?? { expectedVersion: 1 },
    scheduled_for: overrides?.scheduled_for ?? new Date(now.getTime() + 60000),
    status: overrides?.status ?? "pending",
    retry_count: overrides?.retry_count ?? 0,
    next_retry_at: overrides?.next_retry_at ?? null,
    created_by: overrides?.created_by ?? "user-123",
    error_message: overrides?.error_message ?? null,
    correlation_id: overrides?.correlation_id ?? randomUUIDv7(),
    version: overrides?.version ?? 0,
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
  };
}

describe("ScheduleViewRepository", () => {
  test("should save command to batch with correct type", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);
    const scheduleData = createValidScheduleViewData();

    // Act
    repository.save(scheduleData);

    // Assert
    expect(batch.commands.length).toBe(1);
    expect(batch.commands[0]!.type).toBe("insert");
    expect(batch.commands[0]!.statement).toBeDefined();

    // Cleanup
    closeTestDatabase(db);
  });

  test("should handle null commandData when saving", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);

    const now = new Date();
    const scheduleData: ScheduleViewData = {
      aggregate_id: randomUUIDv7(),
      target_aggregate_id: randomUUIDv7(),
      target_aggregate_type: "collection",
      command_type: "publishCollection",
      command_data: null, // Explicitly null
      scheduled_for: new Date(now.getTime() + 60000),
      status: "pending",
      retry_count: 0,
      next_retry_at: null,
      created_by: "user-123",
      error_message: null,
      correlation_id: randomUUIDv7(),
      version: 0,
      created_at: now,
      updated_at: now,
    };

    // Act
    repository.save(scheduleData);

    // Assert
    expect(batch.commands.length).toBe(1);
    expect(batch.commands[0]!.params[4]).toBeNull(); // command_data param

    // Cleanup
    closeTestDatabase(db);
  });

  test("should serialize commandData to JSON string", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);
    const commandData = {
      expectedVersion: 2,
      publishAt: new Date().toISOString(),
      metadata: { source: "test" },
    };
    const scheduleData = createValidScheduleViewData({
      command_data: commandData,
    });

    // Act
    repository.save(scheduleData);

    // Assert
    expect(batch.commands.length).toBe(1);
    const commandDataParam = batch.commands[0]!.params[4];
    expect(typeof commandDataParam).toBe("string");
    expect(JSON.parse(commandDataParam as string)).toEqual(commandData);

    // Cleanup
    closeTestDatabase(db);
  });

  test("should findByScheduleId return schedule when exists", () => {
    // Arrange
    const db = createTestDatabase();
    const scheduleId = randomUUIDv7();
    const commandData = { expectedVersion: 1 };

    // Insert directly
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        randomUUIDv7(),
        "collection",
        "publishCollection",
        JSON.stringify(commandData),
        new Date().toISOString(),
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);

    // Act
    const result = repository.findByScheduleId(scheduleId);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.aggregate_id).toBe(scheduleId);
    expect(result?.command_data).toEqual(commandData);
    expect(result?.status).toBe("pending");

    // Cleanup
    closeTestDatabase(db);
  });

  test("should findByScheduleId return null when not found", () => {
    // Arrange
    const db = createTestDatabase();
    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);
    const nonExistentId = randomUUIDv7();

    // Act
    const result = repository.findByScheduleId(nonExistentId);

    // Assert
    expect(result).toBeNull();

    // Cleanup
    closeTestDatabase(db);
  });

  test("should findDueSchedules return only pending schedules with past scheduledFor", () => {
    // Arrange
    const db = createTestDatabase();

    // Create past pending schedule (should be included)
    const pastPendingId = randomUUIDv7();
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pastPendingId,
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() - 60000).toISOString(), // Past
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    // Create future pending schedule (should NOT be included)
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUIDv7(),
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() + 60000).toISOString(), // Future
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    // Create past executed schedule (should NOT be included)
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUIDv7(),
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() - 60000).toISOString(), // Past
        "executed", // Not pending
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);

    // Act
    const results = repository.findDueSchedules();

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]!.aggregate_id).toBe(pastPendingId);

    // Cleanup
    closeTestDatabase(db);
  });

  test("should findDueSchedules respect nextRetryAt", () => {
    // Arrange
    const db = createTestDatabase();

    // Create schedule with past scheduledFor but future nextRetryAt (should NOT be included)
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUIDv7(),
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() - 60000).toISOString(), // Past
        "pending",
        1,
        new Date(Date.now() + 60000).toISOString(), // Future retry
        "user-123",
        "Error",
        randomUUIDv7(),
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);

    // Act
    const results = repository.findDueSchedules();

    // Assert - Should be empty because nextRetryAt is in future
    expect(results).toHaveLength(0);

    // Cleanup
    closeTestDatabase(db);
  });

  test("should findDueSchedules respect limit parameter", () => {
    // Arrange
    const db = createTestDatabase();

    // Create 5 due schedules
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO schedules_view (
          aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
          command_data, scheduled_for, status, retry_count, next_retry_at,
          created_by, error_message, correlation_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUIDv7(),
          randomUUIDv7(),
          "collection",
          "publishCollection",
          null,
          new Date(Date.now() - 60000).toISOString(),
          "pending",
          0,
          null,
          "user-123",
          null,
          randomUUIDv7(),
          0,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    }

    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);

    // Act
    const results = repository.findDueSchedules(3);

    // Assert
    expect(results).toHaveLength(3);

    // Cleanup
    closeTestDatabase(db);
  });

  test("should findDueSchedules order by scheduledFor ASC", () => {
    // Arrange
    const db = createTestDatabase();

    const id1 = randomUUIDv7();
    const id2 = randomUUIDv7();
    const id3 = randomUUIDv7();

    // Insert in non-chronological order
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id1,
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() - 10000).toISOString(), // 10 sec ago
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id2,
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() - 30000).toISOString(), // 30 sec ago (earliest)
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id3,
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() - 20000).toISOString(), // 20 sec ago
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const batch = new TransactionBatch();
    const repository = new ScheduleViewRepository(db, batch);

    // Act
    const results = repository.findDueSchedules();

    // Assert - Ordered by scheduledFor ASC (earliest first)
    expect(results).toHaveLength(3);
    expect(results[0]!.aggregate_id).toBe(id2); // Earliest
    expect(results[1]!.aggregate_id).toBe(id3);
    expect(results[2]!.aggregate_id).toBe(id1);

    // Cleanup
    closeTestDatabase(db);
  });
});
