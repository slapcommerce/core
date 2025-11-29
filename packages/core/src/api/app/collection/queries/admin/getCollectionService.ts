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
    const row = this.db.query(query).as(CollectionReadModel).get(...queryParams)
    if (!row) return null;
    return {
      ...row,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images
    };
  }

  private buildQuery(params: GetCollectionQuery) {
    let query = `SELECT * FROM collectionsReadModel WHERE aggregateId = ?`
    const queryParams: (string)[] = [params.collectionId]
    return { query, queryParams }
  }
}
