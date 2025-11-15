import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { getSchedulesView } from "../../src/views/schedulesView";
import { schemas } from "../../src/infrastructure/schemas";

describe("getSchedulesView", () => {
  test("should return all schedules with no filters", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const schedule1Id = randomUUIDv7();
    const schedule2Id = randomUUIDv7();

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      schedule1Id,
      randomUUIDv7(),
      "collection",
      "publishCollection",
      JSON.stringify({ expectedVersion: 1 }),
      new Date(Date.now() + 60000).toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      schedule2Id,
      randomUUIDv7(),
      "product",
      "publishProduct",
      null,
      new Date(Date.now() + 120000).toISOString(),
      "executed",
      0,
      null,
      "user-456",
      null,
      randomUUIDv7(),
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Act
    const result = getSchedulesView(db);

    // Assert
    expect(result).toHaveLength(2);
    expect(result.some((s) => s.schedule_id === schedule1Id)).toBe(true);
    expect(result.some((s) => s.schedule_id === schedule2Id)).toBe(true);
  });

  test("should filter schedules by status", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const pendingScheduleId = randomUUIDv7();
    const executedScheduleId = randomUUIDv7();

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      pendingScheduleId,
      randomUUIDv7(),
      "collection",
      "publishCollection",
      null,
      new Date().toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      executedScheduleId,
      randomUUIDv7(),
      "collection",
      "publishCollection",
      null,
      new Date().toISOString(),
      "executed",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Act
    const result = getSchedulesView(db, { status: "pending" });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].schedule_id).toBe(pendingScheduleId);
    expect(result[0].status).toBe("pending");
  });

  test("should filter schedules by targetAggregateId", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const targetId = randomUUIDv7();
    const scheduleId = randomUUIDv7();

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scheduleId,
      targetId,
      "collection",
      "publishCollection",
      null,
      new Date().toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUIDv7(),
      randomUUIDv7(),
      "collection",
      "publishCollection",
      null,
      new Date().toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Act
    const result = getSchedulesView(db, { targetAggregateId: targetId });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].target_aggregate_id).toBe(targetId);
  });

  test("should filter schedules by commandType", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const scheduleId = randomUUIDv7();

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      scheduleId,
      randomUUIDv7(),
      "collection",
      "publishCollection",
      null,
      new Date().toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUIDv7(),
      randomUUIDv7(),
      "product",
      "publishProduct",
      null,
      new Date().toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Act
    const result = getSchedulesView(db, { commandType: "publishCollection" });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].command_type).toBe("publishCollection");
  });

  test("should apply limit and offset for pagination", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    // Insert 5 schedules
    for (let i = 0; i < 5; i++) {
      db.run(
        `INSERT INTO schedules_view (
          aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
          command_data, scheduled_for, status, retry_count, next_retry_at,
          created_by, error_message, correlation_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUIDv7(),
        randomUUIDv7(),
        "collection",
        "publishCollection",
        null,
        new Date(Date.now() + i * 60000).toISOString(),
        "pending",
        0,
        null,
        "user-123",
        null,
        randomUUIDv7(),
        0,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }

    // Act - Get first 2 schedules
    const page1 = getSchedulesView(db, { limit: 2, offset: 0 });

    // Act - Get next 2 schedules
    const page2 = getSchedulesView(db, { limit: 2, offset: 2 });

    // Assert
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].schedule_id).not.toBe(page2[0].schedule_id);
  });

  test("should order schedules by scheduled_for ascending", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const earlier = new Date(Date.now() + 60000);
    const later = new Date(Date.now() + 120000);

    const earlierId = randomUUIDv7();
    const laterId = randomUUIDv7();

    // Insert in reverse order
    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      laterId,
      randomUUIDv7(),
      "collection",
      "publishCollection",
      null,
      later.toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      earlierId,
      randomUUIDv7(),
      "collection",
      "publishCollection",
      null,
      earlier.toISOString(),
      "pending",
      0,
      null,
      "user-123",
      null,
      randomUUIDv7(),
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Act
    const result = getSchedulesView(db);

    // Assert - Earlier schedule should come first
    expect(result).toHaveLength(2);
    expect(result[0].schedule_id).toBe(earlierId);
    expect(result[1].schedule_id).toBe(laterId);
  });

  test("should deserialize commandData JSON correctly", () => {
    // Arrange
    const db = new Database(":memory:");
    for (const schema of schemas) {
      db.run(schema);
    }

    const scheduleId = randomUUIDv7();
    const commandData = { expectedVersion: 5, someKey: "someValue" };

    db.run(
      `INSERT INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      new Date().toISOString()
    );

    // Act
    const result = getSchedulesView(db, { scheduleId });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].command_data).toEqual(commandData);
  });
});
