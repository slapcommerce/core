import type { Database } from "bun:sqlite"
import type { GetSlugRedirectChainQuery } from "./queries"
import type { SlugRedirectChainView } from "./views"
import { SlugRedirectReadModel } from "./views"

export class GetSlugRedirectChainService {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  handle(params: GetSlugRedirectChainQuery): SlugRedirectChainView {
    const rows = this.db.query(`
      SELECT oldSlug as slug, createdAt
      FROM slugRedirects
      WHERE aggregateId = ? AND aggregateType = ?
      ORDER BY createdAt ASC
    `).as(SlugRedirectReadModel).all(params.aggregateId, params.aggregateType)
    return rows;
  }
}
