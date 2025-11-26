import type { Database } from "bun:sqlite";
import type { GetSchedulesQuery } from "./queries";
import type { SchedulesView } from "./views";
import { ScheduleReadModel } from "./views";

export class GetSchedulesService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  handle(params?: GetSchedulesQuery): SchedulesView {
    const { query, queryParams } = this.buildQuery(params);
    const rows = this.db.query(query).as(ScheduleReadModel).all(...queryParams);
    return rows;
  }

  private buildQuery(params?: GetSchedulesQuery) {
    let query = `SELECT * FROM schedulesReadModel WHERE 1=1`;
    const queryParams: (string | number)[] = [];

    if (params?.status) {
      query += ` AND status = ?`;
      queryParams.push(params.status);
    }
    if (params?.targetAggregateId) {
      query += ` AND targetAggregateId = ?`;
      queryParams.push(params.targetAggregateId);
    }
    if (params?.targetAggregateType) {
      query += ` AND targetAggregateType = ?`;
      queryParams.push(params.targetAggregateType);
    }
    if (params?.commandType) {
      query += ` AND commandType = ?`;
      queryParams.push(params.commandType);
    }
    query += ` ORDER BY scheduledFor ASC`;
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
    return { query, queryParams };
  }
}
