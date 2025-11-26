import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type SlugRedirectData = {
  oldSlug: string;
  newSlug: string;
  aggregateId: string;
  aggregateType: 'product' | 'collection';
  productId: string | null;
  createdAt: Date;
};

type SlugRedirectRow = {
  oldSlug: string;
  newSlug: string;
  aggregateId: string;
  aggregateType: string;
  productId: string | null;
  createdAt: string;
};

export class SlugRedirectRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(data: SlugRedirectData) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO slugRedirects (
        oldSlug, newSlug, aggregateId, aggregateType, productId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        data.oldSlug,
        data.newSlug,
        data.aggregateId,
        data.aggregateType,
        data.productId,
        data.createdAt.toISOString(),
      ],
      type: 'insert'
    })
  }
}
