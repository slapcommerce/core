import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../../transactionBatch"

export type SlugRedirectState = {
  oldSlug: string
  newSlug: string
  aggregateId: string
  aggregateType: 'collection' | 'product' | 'category'
  createdAt: Date
}

export class SlugRedirectReadModelRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(data: SlugRedirectState): void {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO slugRedirects (
        oldSlug, newSlug, aggregateId, aggregateType, createdAt
      ) VALUES (?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        data.oldSlug,
        data.newSlug,
        data.aggregateId,
        data.aggregateType,
        data.createdAt.toISOString(),
      ],
      type: 'insert'
    })
  }
}
