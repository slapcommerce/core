import type { Database } from "bun:sqlite";
import type { GetSchedulesByAggregateIdQuery } from "./queries";
import type { SchedulesView } from "./views";
import { ScheduleReadModel } from "./views";

export class GetSchedulesByAggregateIdService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  handle(params: GetSchedulesByAggregateIdQuery): SchedulesView {
    const { query, queryParams } = this.buildQuery(params);
    const rows = this.db.query(query).as(ScheduleReadModel).all(...queryParams);
    return rows.map((row) => ({
      ...row,
      metadata:
        typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
    }));
  }

  private buildQuery(params: GetSchedulesByAggregateIdQuery) {
    let query = `SELECT * FROM pendingSchedulesReadModel WHERE aggregateId = ?`;
    const queryParams: (string | number)[] = [params.aggregateId];

    if (params.status) {
      query += ` AND status = ?`;
      queryParams.push(params.status);
    }

    query += ` ORDER BY dueAt ASC`;

    return { query, queryParams };
  }
}
