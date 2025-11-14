import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type CollectionsListViewData = {
  aggregate_id: string
  name: string
  slug: string
  description: string | null
  status: "draft" | "active" | "archived"
  correlation_id: string
  version: number
  created_at: Date
  updated_at: Date
  meta_title: string
  meta_description: string
  published_at: Date | null
  image_urls: string | null
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
        aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, meta_title, meta_description, published_at, image_urls
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        data.meta_title,
        data.meta_description,
        data.published_at ? data.published_at.toISOString() : null,
        data.image_urls,
      ],
      type: 'insert'
    })
  }

  findByCollectionId(collectionId: string): CollectionsListViewData | null {
    const row = this.db.query(
      `SELECT aggregate_id, name, slug, description, status, correlation_id, version, created_at, updated_at, meta_title, meta_description, published_at, image_urls
       FROM collections_list_view
       WHERE aggregate_id = ?`
    ).get(collectionId) as {
      aggregate_id: string
      name: string
      slug: string
      description: string | null
      status: "draft" | "active" | "archived"
      correlation_id: string
      version: number
      created_at: string
      updated_at: string
      meta_title: string
      meta_description: string
      published_at: string | null
      image_urls: string | null
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
      meta_title: row.meta_title ?? "",
      meta_description: row.meta_description ?? "",
      published_at: row.published_at ? new Date(row.published_at) : null,
      image_urls: row.image_urls,
    }
  }
}

