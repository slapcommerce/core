import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";

export type PendingScheduleStatus = "pending" | "completed" | "cancelled" | "failed";

export type PendingScheduleRecord = {
  scheduleId: string;
  scheduleGroupId: string | null;
  aggregateId: string;
  aggregateType: string;
  scheduleType: string;
  dueAt: Date;
  status: PendingScheduleStatus;
  retryCount: number;
  nextRetryAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PendingSchedulesReadModelRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(record: PendingScheduleRecord) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO pendingSchedulesReadModel (
        scheduleId, scheduleGroupId, aggregateId, aggregateType, scheduleType,
        dueAt, status, retryCount, nextRetryAt, errorMessage, metadata,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    this.batch.addCommand({
      statement,
      params: [
        record.scheduleId,
        record.scheduleGroupId,
        record.aggregateId,
        record.aggregateType,
        record.scheduleType,
        record.dueAt.toISOString(),
        record.status,
        record.retryCount,
        record.nextRetryAt ? record.nextRetryAt.toISOString() : null,
        record.errorMessage,
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.createdAt.toISOString(),
        record.updatedAt.toISOString(),
      ],
      type: "insert",
    });
  }

  updateStatus(scheduleId: string, status: PendingScheduleStatus, errorMessage?: string) {
    const statement = this.db.query(
      `UPDATE pendingSchedulesReadModel
       SET status = ?, errorMessage = ?, updatedAt = ?
       WHERE scheduleId = ?`
    );

    this.batch.addCommand({
      statement,
      params: [status, errorMessage ?? null, new Date().toISOString(), scheduleId],
      type: "update",
    });
  }

  delete(scheduleId: string) {
    const statement = this.db.query(
      `DELETE FROM pendingSchedulesReadModel WHERE scheduleId = ?`
    );

    this.batch.addCommand({
      statement,
      params: [scheduleId],
      type: "delete",
    });
  }

  deleteByGroupId(scheduleGroupId: string) {
    const statement = this.db.query(
      `DELETE FROM pendingSchedulesReadModel WHERE scheduleGroupId = ?`
    );

    this.batch.addCommand({
      statement,
      params: [scheduleGroupId],
      type: "delete",
    });
  }

  findDueSchedules(limit: number = 100): PendingScheduleRecord[] {
    const now = new Date().toISOString();
    const rows = this.db
      .query(
        `SELECT * FROM pendingSchedulesReadModel
         WHERE status = 'pending' AND dueAt <= ?
         ORDER BY dueAt ASC
         LIMIT ?`
      )
      .all(now, limit) as any[];

    return rows.map(this.rowToRecord);
  }

  findByAggregateId(aggregateId: string): PendingScheduleRecord[] {
    const rows = this.db
      .query(`SELECT * FROM pendingSchedulesReadModel WHERE aggregateId = ?`)
      .all(aggregateId) as any[];

    return rows.map(this.rowToRecord);
  }

  findByScheduleId(scheduleId: string): PendingScheduleRecord | null {
    const row = this.db
      .query(`SELECT * FROM pendingSchedulesReadModel WHERE scheduleId = ?`)
      .get(scheduleId) as any;

    return row ? this.rowToRecord(row) : null;
  }

  private rowToRecord(row: any): PendingScheduleRecord {
    return {
      scheduleId: row.scheduleId,
      scheduleGroupId: row.scheduleGroupId,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      scheduleType: row.scheduleType,
      dueAt: new Date(row.dueAt),
      status: row.status,
      retryCount: row.retryCount,
      nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt) : null,
      errorMessage: row.errorMessage,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
