import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../transactionBatch";

export type ScheduleViewData = {
  aggregate_id: string;
  target_aggregate_id: string;
  target_aggregate_type: string;
  command_type: string;
  command_data: Record<string, unknown> | null;
  scheduled_for: Date;
  status: "pending" | "executed" | "failed" | "cancelled";
  retry_count: number;
  next_retry_at: Date | null;
  created_by: string;
  error_message: string | null;
  correlation_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export class ScheduleViewRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(data: ScheduleViewData) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO schedules_view (
        aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
        command_data, scheduled_for, status, retry_count, next_retry_at,
        created_by, error_message, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    this.batch.addCommand({
      statement,
      params: [
        data.aggregate_id,
        data.target_aggregate_id,
        data.target_aggregate_type,
        data.command_type,
        data.command_data ? JSON.stringify(data.command_data) : null,
        data.scheduled_for.toISOString(),
        data.status,
        data.retry_count,
        data.next_retry_at ? data.next_retry_at.toISOString() : null,
        data.created_by,
        data.error_message,
        data.correlation_id,
        data.version,
        data.created_at.toISOString(),
        data.updated_at.toISOString(),
      ],
      type: "insert",
    });
  }

  findByScheduleId(scheduleId: string): ScheduleViewData | null {
    const row = this.db
      .query(
        `SELECT aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
                command_data, scheduled_for, status, retry_count, next_retry_at,
                created_by, error_message, correlation_id, version, created_at, updated_at
         FROM schedules_view
         WHERE aggregate_id = ?`
      )
      .get(scheduleId) as {
      aggregate_id: string;
      target_aggregate_id: string;
      target_aggregate_type: string;
      command_type: string;
      command_data: string | null;
      scheduled_for: string;
      status: "pending" | "executed" | "failed" | "cancelled";
      retry_count: number;
      next_retry_at: string | null;
      created_by: string;
      error_message: string | null;
      correlation_id: string;
      version: number;
      created_at: string;
      updated_at: string;
    } | null;

    if (!row) {
      return null;
    }

    return {
      aggregate_id: row.aggregate_id,
      target_aggregate_id: row.target_aggregate_id,
      target_aggregate_type: row.target_aggregate_type,
      command_type: row.command_type,
      command_data: row.command_data
        ? (JSON.parse(row.command_data) as Record<string, unknown>)
        : null,
      scheduled_for: new Date(row.scheduled_for),
      status: row.status,
      retry_count: row.retry_count,
      next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : null,
      created_by: row.created_by,
      error_message: row.error_message,
      correlation_id: row.correlation_id,
      version: row.version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  findDueSchedules(limit: number = 100): ScheduleViewData[] {
    const now = new Date().toISOString();
    const rows = this.db
      .query(
        `SELECT aggregate_id, target_aggregate_id, target_aggregate_type, command_type,
                command_data, scheduled_for, status, retry_count, next_retry_at,
                created_by, error_message, correlation_id, version, created_at, updated_at
         FROM schedules_view
         WHERE status = 'pending'
           AND scheduled_for <= ?
           AND (next_retry_at IS NULL OR next_retry_at <= ?)
         ORDER BY scheduled_for ASC
         LIMIT ?`
      )
      .all(now, now, limit) as Array<{
      aggregate_id: string;
      target_aggregate_id: string;
      target_aggregate_type: string;
      command_type: string;
      command_data: string | null;
      scheduled_for: string;
      status: "pending" | "executed" | "failed" | "cancelled";
      retry_count: number;
      next_retry_at: string | null;
      created_by: string;
      error_message: string | null;
      correlation_id: string;
      version: number;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      aggregate_id: row.aggregate_id,
      target_aggregate_id: row.target_aggregate_id,
      target_aggregate_type: row.target_aggregate_type,
      command_type: row.command_type,
      command_data: row.command_data
        ? (JSON.parse(row.command_data) as Record<string, unknown>)
        : null,
      scheduled_for: new Date(row.scheduled_for),
      status: row.status,
      retry_count: row.retry_count,
      next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : null,
      created_by: row.created_by,
      error_message: row.error_message,
      correlation_id: row.correlation_id,
      version: row.version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }
}
