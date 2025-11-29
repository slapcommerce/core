import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";
import type { BundleState } from "@/api/domain/bundle/events";

export class BundlesReadModelRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(state: BundleState & { id: string; correlationId: string; version: number }) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO bundleReadModel (
        aggregateId, correlationId, version,
        name, description, slug, items,
        price, compareAtPrice,
        metaTitle, metaDescription, richDescriptionUrl,
        tags, collections, images,
        taxable, taxId,
        createdAt, updatedAt, status, publishedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.correlationId,
        state.version,
        state.name,
        state.description,
        state.slug,
        JSON.stringify(state.items),
        state.price,
        state.compareAtPrice,
        state.metaTitle,
        state.metaDescription,
        state.richDescriptionUrl,
        JSON.stringify(state.tags),
        JSON.stringify(state.collections),
        JSON.stringify(state.images),
        state.taxable ? 1 : 0,
        state.taxId,
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),
        state.status,
        state.publishedAt?.toISOString() ?? null,
      ],
      type: "insert",
    });
  }
}
