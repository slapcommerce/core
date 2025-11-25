import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../../transactionBatch"
import type { CollectionState } from "@/api/domain/collection/events"


export class CollectionsReadModelRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(state: CollectionState) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO collections_list_read_model (
        id, correlation_id, created_at, updated_at, name, description, slug, version, status,
        meta_title, meta_description, published_at, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.correlationId,
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),
        state.name,
        state.description,
        state.slug,
        state.version,
        state.status,
        state.metaTitle,
        state.metaDescription,
        state.publishedAt ? state.publishedAt.toISOString() : null,
        JSON.stringify(state.images),
      ],
      type: 'insert'
    })
  }
}
