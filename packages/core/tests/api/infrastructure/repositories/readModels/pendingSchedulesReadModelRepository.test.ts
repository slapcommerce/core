import { describe, test, expect } from "bun:test";
import { PendingSchedulesReadModelRepository } from "../../../../../src/api/infrastructure/repositories/readModels/pendingSchedulesReadModelRepository";
import { TransactionBatch } from "../../../../../src/api/infrastructure/transactionBatch";
import {
  createTestDatabase,
  closeTestDatabase,
} from "../../../../helpers/database";

describe("PendingSchedulesReadModelRepository", () => {
  test("should add save command to batch with correct parameters", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new PendingSchedulesReadModelRepository(db, batch);
      const now = new Date();

      repository.save({
        scheduleId: "schedule-123",
        scheduleGroupId: "group-123",
        aggregateId: "variant-123",
        aggregateType: "dropship_variant",
        scheduleType: "sale_start",
        dueAt: now,
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        errorMessage: null,
        metadata: { saleType: "percent", saleValue: 0.2 },
        createdAt: now,
        updatedAt: now,
      });

      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("insert");
      expect(batch.commands[0]!.params[0]).toBe("schedule-123");
      expect(batch.commands[0]!.params[1]).toBe("group-123");
      expect(batch.commands[0]!.params[2]).toBe("variant-123");
      expect(batch.commands[0]!.params[3]).toBe("dropship_variant");
      expect(batch.commands[0]!.params[4]).toBe("sale_start");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add updateStatus command to batch", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new PendingSchedulesReadModelRepository(db, batch);

      repository.updateStatus("schedule-123", "completed");

      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("update");
      expect(batch.commands[0]!.params[0]).toBe("completed");
      expect(batch.commands[0]!.params[1]).toBeNull(); // errorMessage
      expect(batch.commands[0]!.params[3]).toBe("schedule-123");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add updateStatus with error message to batch", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new PendingSchedulesReadModelRepository(db, batch);

      repository.updateStatus("schedule-123", "failed", "Something went wrong");

      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("update");
      expect(batch.commands[0]!.params[0]).toBe("failed");
      expect(batch.commands[0]!.params[1]).toBe("Something went wrong");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add delete command to batch", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new PendingSchedulesReadModelRepository(db, batch);

      repository.delete("schedule-123");

      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("delete");
      expect(batch.commands[0]!.params[0]).toBe("schedule-123");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should add deleteByGroupId command to batch", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new PendingSchedulesReadModelRepository(db, batch);

      repository.deleteByGroupId("group-123");

      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0]!.type).toBe("delete");
      expect(batch.commands[0]!.params[0]).toBe("group-123");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should find due schedules", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      // Insert test data directly
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const now = new Date().toISOString();

      db.run(`
        INSERT INTO pendingSchedulesReadModel (
          scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
          dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
          createdAt, updatedAt
        ) VALUES
        ('due-schedule', 'group-1', 'variant-1', 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, NULL, ?, ?),
        ('future-schedule', 'group-2', 'variant-2', 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, NULL, ?, ?),
        ('completed-schedule', 'group-3', 'variant-3', 'dropship_variant', 'sale_start', ?, 'completed', 0, NULL, NULL, NULL, ?, ?)
      `, [pastDate, now, now, futureDate, now, now, pastDate, now, now]);

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const dueSchedules = repository.findDueSchedules();

      expect(dueSchedules).toHaveLength(1);
      expect(dueSchedules[0]!.scheduleId).toBe("due-schedule");
      expect(dueSchedules[0]!.status).toBe("pending");
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should respect limit when finding due schedules", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const now = new Date().toISOString();

      // Insert 5 due schedules
      for (let i = 1; i <= 5; i++) {
        db.run(`
          INSERT INTO pendingSchedulesReadModel (
            scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
            dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, NULL, ?, ?)
        `, [`schedule-${i}`, `group-${i}`, `variant-${i}`, pastDate, now, now]);
      }

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const dueSchedules = repository.findDueSchedules(2);

      expect(dueSchedules).toHaveLength(2);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should find schedules by aggregate ID", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const now = new Date().toISOString();

      db.run(`
        INSERT INTO pendingSchedulesReadModel (
          scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
          dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
          createdAt, updatedAt
        ) VALUES
        ('schedule-1', 'group-1', 'variant-target', 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, NULL, ?, ?),
        ('schedule-2', 'group-1', 'variant-target', 'dropship_variant', 'sale_end', ?, 'pending', 0, NULL, NULL, NULL, ?, ?),
        ('schedule-3', 'group-2', 'variant-other', 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, NULL, ?, ?)
      `, [now, now, now, now, now, now, now, now, now]);

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const schedules = repository.findByAggregateId("variant-target");

      expect(schedules).toHaveLength(2);
      expect(schedules.every(s => s.aggregateId === "variant-target")).toBe(true);
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should find schedule by schedule ID", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const now = new Date().toISOString();

      db.run(`
        INSERT INTO pendingSchedulesReadModel (
          scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
          dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
          createdAt, updatedAt
        ) VALUES ('schedule-123', 'group-123', 'variant-123', 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, '{"saleType":"percent"}', ?, ?)
      `, [now, now, now]);

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const schedule = repository.findByScheduleId("schedule-123");

      expect(schedule).not.toBeNull();
      expect(schedule!.scheduleId).toBe("schedule-123");
      expect(schedule!.aggregateId).toBe("variant-123");
      expect(schedule!.metadata).toEqual({ saleType: "percent" });
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should return null when schedule not found", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const schedule = repository.findByScheduleId("non-existent");

      expect(schedule).toBeNull();
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should include schedules regardless of nextRetryAt", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const futureRetry = new Date(Date.now() + 86400000).toISOString();
      const now = new Date().toISOString();

      // findDueSchedules only checks status and dueAt, not nextRetryAt
      // The nextRetryAt filtering is done by the SaleSchedulePoller
      db.run(`
        INSERT INTO pendingSchedulesReadModel (
          scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
          dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
          createdAt, updatedAt
        ) VALUES
        ('schedule-with-retry', 'group-1', 'variant-1', 'dropship_variant', 'sale_start', ?, 'pending', 1, ?, NULL, NULL, ?, ?)
      `, [pastDate, futureRetry, now, now]);

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const dueSchedules = repository.findDueSchedules();

      // Repository returns all due pending schedules, poller filters by nextRetryAt
      expect(dueSchedules).toHaveLength(1);
      expect(dueSchedules[0]!.scheduleId).toBe("schedule-with-retry");
      expect(dueSchedules[0]!.nextRetryAt).not.toBeNull();
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should properly parse metadata as JSON", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const now = new Date().toISOString();

      db.run(`
        INSERT INTO pendingSchedulesReadModel (
          scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
          dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
          createdAt, updatedAt
        ) VALUES ('schedule-with-meta', 'group-1', 'variant-1', 'dropship_variant', 'sale_start', ?, 'pending', 0, NULL, NULL, '{"saleType":"fixed","saleValue":1999}', ?, ?)
      `, [now, now, now]);

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const schedule = repository.findByScheduleId("schedule-with-meta");

      expect(schedule!.metadata).toEqual({ saleType: "fixed", saleValue: 1999 });
    } finally {
      closeTestDatabase(db);
    }
  });

  test("should handle null metadata", () => {
    const db = createTestDatabase();
    const batch = new TransactionBatch();

    try {
      const now = new Date().toISOString();

      db.run(`
        INSERT INTO pendingSchedulesReadModel (
          scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
          dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
          createdAt, updatedAt
        ) VALUES ('schedule-no-meta', 'group-1', 'variant-1', 'dropship_variant', 'sale_end', ?, 'pending', 0, NULL, NULL, NULL, ?, ?)
      `, [now, now, now]);

      const repository = new PendingSchedulesReadModelRepository(db, batch);

      const schedule = repository.findByScheduleId("schedule-no-meta");

      expect(schedule!.metadata).toBeNull();
    } finally {
      closeTestDatabase(db);
    }
  });
});
