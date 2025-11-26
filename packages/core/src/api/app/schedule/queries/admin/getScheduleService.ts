import type { Database } from "bun:sqlite";
import type { GetScheduleQuery } from "./queries";
import type { ScheduleView } from "./views";
import { ScheduleReadModel } from "./views";

export class GetScheduleService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  handle(params: GetScheduleQuery): ScheduleView {
    const query = `SELECT * FROM schedulesReadModel WHERE aggregateId = ?`;
    const row = this.db.query(query).as(ScheduleReadModel).get(params.scheduleId);
    return row ?? null;
  }
}
