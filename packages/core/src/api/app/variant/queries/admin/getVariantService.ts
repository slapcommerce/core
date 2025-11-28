import type { Database } from "bun:sqlite"
import { GetVariantQuery } from "./queries"
import type { VariantView } from "./views"
import { VariantReadModel } from "./views"


export class VariantViewQueryHandler {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  handle(params: GetVariantQuery): VariantView {
    const { query, queryParams } = this.buildQuery(params)
    const rows = this.db.query(query).as(VariantReadModel).get(...queryParams)
    return rows;
  }

  private buildQuery(params: GetVariantQuery) {
    let query = `SELECT * FROM variantReadModel WHERE aggregateId = ?`
    const queryParams: (string)[] = [params.variantId]
    return { query, queryParams }
  }
}
