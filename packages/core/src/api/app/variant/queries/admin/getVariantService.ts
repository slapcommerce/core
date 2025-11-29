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
    const row = this.db.query(query).as(VariantReadModel).get(...queryParams)
    if (!row) return null;
    return {
      ...row,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images,
      digitalAsset: row.digitalAsset && typeof row.digitalAsset === 'string' ? JSON.parse(row.digitalAsset) : row.digitalAsset
    };
  }

  private buildQuery(params: GetVariantQuery) {
    let query = `SELECT * FROM variantReadModel WHERE aggregateId = ?`
    const queryParams: (string)[] = [params.variantId]
    return { query, queryParams }
  }
}
