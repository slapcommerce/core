import type { Database } from "bun:sqlite"
import { GetCollectionsQuery, GetCollectionQuery } from "./queries"
import type { CollectionsView, CollectionView } from "./views"
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

export class CollectionsViewQueryHandler {
  private db: Database
  
  constructor(db: Database) {
    this.db = db
  }

  handle(params?: GetCollectionsQuery): CollectionsView {
    const { query, queryParams } = this.buildQuery(params)
    const rows = this.db.query(query).as(CollectionReadModel).all(...queryParams)
    return rows;
  }

  private buildQuery(params?: GetCollectionsQuery) {
    let query = `SELECT * FROM collections_list_read_model WHERE 1=1`
    const queryParams: (string | number)[] = []

    if (params?.status) {
      // Map 'draft' status to 'active' in the view (draft collections are shown as active)
      const status = params.status === 'draft' ? 'active' : params.status
      query += ` AND status = ?`
      queryParams.push(status)
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
