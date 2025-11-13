import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type CollectionsListViewData = {
  aggregate_id: string
  name: string
  slug: string
  description: string | null
  status: "active" | "archived"
  correlation_id: string
  version: number
  created_at: Date
  updated_at: Date
}

export class CollectionsListViewRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(data: CollectionsListViewData) {
    // Prepare the statement and queue it for execution
    // Use INSERT OR REPLACE since aggregate_id is primary key
    const statement = this.db.query(
      `INSERT OR REPLACE INTO collections_list_view (
        aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        data.aggregate_id,
        data.name,
        data.slug,
        data.description,
        data.status,
        data.correlation_id,
        data.version,
        data.created_at.toISOString(),
        data.updated_at.toISOString(),
      ],
      type: 'insert'
    })
  }

  findByCollectionId(collectionId: string): CollectionsListViewData | null {
    const row = this.db.query(
      `SELECT aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at
       FROM collections_list_view
       WHERE aggregate_id = ?`
    ).get(collectionId) as {
      aggregate_id: string
      name: string
      slug: string
      description: string | null
      status: "active" | "archived"
      correlation_id: string
      version: number
      created_at: string
      updated_at: string
    } | null

    if (!row) {
      return null
    }

    return {
      aggregate_id: row.aggregate_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      correlation_id: row.correlation_id,
      version: row.version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }
  }
}

