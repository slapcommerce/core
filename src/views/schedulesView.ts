import type { Database } from "bun:sqlite";

export type SchedulesViewParams = {
  scheduleId?: string;
  status?: "pending" | "executed" | "failed" | "cancelled";
  targetAggregateId?: string;
  targetAggregateType?: string;
  commandType?: string;
  limit?: number;
  offset?: number;
};

export function getSchedulesView(
  db: Database,
  params?: SchedulesViewParams
) {
  let query = `SELECT * FROM schedules_view WHERE 1=1`;
  const queryParams: (string | number)[] = [];

  if (params?.scheduleId) {
    query += ` AND aggregate_id = ?`;
    queryParams.push(params.scheduleId);
  }

  if (params?.status) {
    query += ` AND status = ?`;
    queryParams.push(params.status);
  }

  if (params?.targetAggregateId) {
    query += ` AND target_aggregate_id = ?`;
    queryParams.push(params.targetAggregateId);
  }

  if (params?.targetAggregateType) {
    query += ` AND target_aggregate_type = ?`;
    queryParams.push(params.targetAggregateType);
  }

  if (params?.commandType) {
    query += ` AND command_type = ?`;
    queryParams.push(params.commandType);
  }

  // Order by scheduled_for ascending (soonest first)
  query += ` ORDER BY scheduled_for ASC`;

  if (params?.limit) {
    query += ` LIMIT ?`;
    queryParams.push(params.limit);
  }
  if (params?.offset) {
    if (!params?.limit) {
      query += ` LIMIT -1`;
    }
    query += ` OFFSET ?`;
    queryParams.push(params.offset);
  }

  const rows = db.query(query).all(...queryParams) as Array<{
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
    schedule_id: row.aggregate_id,
    target_aggregate_id: row.target_aggregate_id,
    target_aggregate_type: row.target_aggregate_type,
    command_type: row.command_type,
    command_data: row.command_data ? JSON.parse(row.command_data) : null,
    scheduled_for: row.scheduled_for,
    status: row.status,
    retry_count: row.retry_count,
    next_retry_at: row.next_retry_at,
    created_by: row.created_by,
    error_message: row.error_message,
    correlation_id: row.correlation_id,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
