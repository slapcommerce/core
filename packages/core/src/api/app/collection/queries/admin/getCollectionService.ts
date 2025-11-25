import type { Database } from "bun:sqlite"
import { GetCollectionQuery } from "./queries"
import type { CollectionView } from "./views"
import { CollectionReadModel } from "./views"


export class CollectionViewQueryHandler {
  private db: Database
  
  constructor(db: Database) {
    this.db = db
  }

  handle(params: GetCollectionQuery): CollectionView {
    const { query, queryParams } = this.buildQuery(params)
    const rows = this.db.query(query).as(CollectionReadModel).get(...queryParams)
    return rows;
  }

  private buildQuery(params: GetCollectionQuery) {
    let query = `SELECT * FROM collections_list_read_model WHERE collection_id = ?`
    const queryParams: (string)[] = [params.collectionId]
    return { query, queryParams }
  }
}