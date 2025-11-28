import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../../transactionBatch"
import type { VariantState } from "@/api/domain/variant/events"


export class VariantsReadModelRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(state: VariantState & { id: string; correlationId: string; version: number }) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO variantReadModel (
        aggregateId, productId, sku, price, inventory, options,
        status, correlationId, version, createdAt, updatedAt,
        publishedAt, images, digitalAsset
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.productId,
        state.sku,
        state.price,
        state.inventory,
        JSON.stringify(state.options),
        state.status,
        state.correlationId,
        state.version,
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),
        state.publishedAt?.toISOString() ?? null,
        JSON.stringify(state.images),
        state.digitalAsset ? JSON.stringify(state.digitalAsset) : null,
      ],
      type: 'insert'
    })
  }
}
