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
    const row = this.db.query(query).as(ProductReadModel).get(...queryParams)
    if (!row) return null;
    return {
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      variantOptions: typeof row.variantOptions === 'string' ? JSON.parse(row.variantOptions) : row.variantOptions,
      collections: typeof row.collections === 'string' ? JSON.parse(row.collections) : row.collections
    };
  }

  private buildQuery(params: GetProductQuery) {
    let query = `SELECT * FROM productReadModel WHERE aggregateId = ?`
    const queryParams: (string)[] = [params.productId]
    return { query, queryParams }
  }
}
