import type { Database } from "bun:sqlite"
import { GetProductQuery } from "./queries"
import type { ProductView } from "./views"
import { ProductReadModel } from "./views"


export class ProductViewQueryHandler {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  handle(params: GetProductQuery): ProductView {
    const { query, queryParams } = this.buildQuery(params)
    const rows = this.db.query(query).as(ProductReadModel).get(...queryParams)
    return rows;
  }

  private buildQuery(params: GetProductQuery) {
    let query = `SELECT * FROM productReadModel WHERE aggregateId = ?`
    const queryParams: (string)[] = [params.productId]
    return { query, queryParams }
  }
}
