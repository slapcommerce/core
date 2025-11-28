import type { Database } from "bun:sqlite"
import { GetVariantsQuery } from "./queries"
import type { VariantsView } from "./views"
import { VariantReadModel } from "./views"


export class GetVariantsService {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  handle(params?: GetVariantsQuery): VariantsView {
    const { query, queryParams } = this.buildQuery(params)
    const rows = this.db.query(query).as(VariantReadModel).all(...queryParams)
    return rows;
  }

  private buildQuery(params?: GetVariantsQuery) {
    let query = `SELECT * FROM variantReadModel WHERE 1=1`
    const queryParams: (string | number)[] = []

    if (params?.productId) {
      query += ` AND productId = ?`
      queryParams.push(params.productId)
    }

    if (params?.status) {
      query += ` AND status = ?`
      queryParams.push(params.status)
    }

    if (params?.limit) {
      query += ` LIMIT ?`
      queryParams.push(params.limit)
    }
    if (params?.offset) {
      if (!params?.limit) {
        query += ` LIMIT -1`
      }
      query += ` OFFSET ?`
      queryParams.push(params.offset)
    }
    return { query, queryParams }
  }
}
