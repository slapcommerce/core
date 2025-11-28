import type { Database } from "bun:sqlite"
import { GetProductsQuery } from "./queries"
import type { ProductsView } from "./views"
import { ProductReadModel } from "./views"


export class GetProductsService {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  handle(params?: GetProductsQuery): ProductsView {
    const { query, queryParams } = this.buildQuery(params)
    const rows = this.db.query(query).as(ProductReadModel).all(...queryParams)
    return rows;
  }

  private buildQuery(params?: GetProductsQuery) {
    let query = `SELECT * FROM productReadModel WHERE 1=1`
    const queryParams: (string | number)[] = []

    if (params?.status) {
      query += ` AND status = ?`
      queryParams.push(params.status)
    }

    if (params?.collectionId) {
      // Use SQLite JSON functions to filter by collection ID in the JSON array
      query += ` AND EXISTS (SELECT 1 FROM json_each(collectionIds) WHERE json_each.value = ?)`
      queryParams.push(params.collectionId)
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
