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
      SELECT old_slug as slug, created_at
      FROM slug_redirects
      WHERE entity_id = ? AND entity_type = ?
      ORDER BY created_at ASC
    `).as(SlugRedirectReadModel).all(params.entityId, params.entityType)
    return rows;
  }
}
