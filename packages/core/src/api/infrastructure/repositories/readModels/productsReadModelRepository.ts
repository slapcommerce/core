import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";
import type { ProductState } from "@/api/domain/product/events";

export class ProductsReadModelRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(state: ProductState & { id: string; correlationId: string; version: number }) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO productReadModel (
        aggregateId, name, slug, vendor, description, tags,
        createdAt, status, correlationId, taxable, taxId, fulfillmentType,
        dropshipSafetyBuffer, variantOptions, version, updatedAt, publishedAt,
        collections, metaTitle, metaDescription, richDescriptionUrl, defaultVariantId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.name,
        state.slug,
        state.vendor,
        state.description,
        JSON.stringify(state.tags),
        state.createdAt.toISOString(),
        state.status,
        state.correlationId,
        state.taxable ? 1 : 0,
        state.taxId,
        state.fulfillmentType,
        state.dropshipSafetyBuffer ?? null,
        JSON.stringify(state.variantOptions),
        state.version,
        state.updatedAt.toISOString(),
        state.publishedAt?.toISOString() ?? null,
        JSON.stringify(state.collections),
        state.metaTitle,
        state.metaDescription,
        state.richDescriptionUrl,
        state.defaultVariantId,
      ],
      type: "insert",
    });
  }
}
