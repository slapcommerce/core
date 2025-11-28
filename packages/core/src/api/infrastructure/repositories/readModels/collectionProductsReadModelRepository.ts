import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";
import type { ProductState } from "@/api/domain/product/events";

export type CollectionProductEntry = {
  collectionId: string;
  productId: string;
  position: number;
  name: string;
  slug: string;
  vendor: string;
  description: string;
  tags: string[];
  status: "draft" | "active" | "archived";
  taxable: boolean;
  taxId: string;
  fulfillmentType: "digital" | "dropship";
  dropshipSafetyBuffer?: number;
  variantOptions: Array<{ name: string; values: string[] }>;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  variantIds: string[];
  productCreatedAt: Date;
  productUpdatedAt: Date;
  publishedAt: Date | null;
  correlationId: string;
  productVersion: number;
};

export class CollectionProductsReadModelRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(entry: CollectionProductEntry): void {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO collectionProductsReadModel (
        collectionId, productId, position, name, slug, vendor, description,
        tags, status, taxable, taxId, fulfillmentType, dropshipSafetyBuffer,
        variantOptions, metaTitle, metaDescription, richDescriptionUrl,
        variantIds, productCreatedAt, productUpdatedAt, publishedAt,
        correlationId, productVersion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.batch.addCommand({
      statement,
      params: [
        entry.collectionId,
        entry.productId,
        entry.position,
        entry.name,
        entry.slug,
        entry.vendor,
        entry.description,
        JSON.stringify(entry.tags),
        entry.status,
        entry.taxable ? 1 : 0,
        entry.taxId,
        entry.fulfillmentType,
        entry.dropshipSafetyBuffer ?? null,
        JSON.stringify(entry.variantOptions),
        entry.metaTitle,
        entry.metaDescription,
        entry.richDescriptionUrl,
        JSON.stringify(entry.variantIds),
        entry.productCreatedAt.toISOString(),
        entry.productUpdatedAt.toISOString(),
        entry.publishedAt?.toISOString() ?? null,
        entry.correlationId,
        entry.productVersion,
      ],
      type: "insert",
    });
  }

  saveFromProductState(
    productId: string,
    state: ProductState & {
      correlationId: string;
      version: number;
    },
  ): void {
    // collections is now string[] (just IDs)
    // position defaults to 0 - will be updated by CollectionProductOrdering aggregate
    for (const collectionId of state.collections) {
      this.save({
        collectionId,
        productId,
        position: 0,  // Default, updated by CollectionProductOrdering
        name: state.name,
        slug: state.slug,
        vendor: state.vendor,
        description: state.description,
        tags: state.tags,
        status: state.status,
        taxable: state.taxable,
        taxId: state.taxId,
        fulfillmentType: state.fulfillmentType,
        dropshipSafetyBuffer: state.dropshipSafetyBuffer,
        variantOptions: state.variantOptions,
        metaTitle: state.metaTitle,
        metaDescription: state.metaDescription,
        richDescriptionUrl: state.richDescriptionUrl,
        variantIds: state.variantIds,
        productCreatedAt: state.createdAt,
        productUpdatedAt: state.updatedAt,
        publishedAt: state.publishedAt,
        correlationId: state.correlationId,
        productVersion: state.version,
      });
    }
  }

  updatePositions(
    collectionId: string,
    positions: Array<{ productId: string; position: number }>,
  ): void {
    if (positions.length === 0) return;

    // Build CASE statement for efficient bulk update
    const caseStatements = positions
      .map((p) => `WHEN '${p.productId}' THEN ${p.position}`)
      .join(" ");
    const productIds = positions.map((p) => `'${p.productId}'`).join(", ");

    const sql = `
      UPDATE collectionProductsReadModel
      SET position = CASE productId ${caseStatements} END
      WHERE collectionId = ? AND productId IN (${productIds})
    `;

    const statement = this.db.query(sql);
    this.batch.addCommand({
      statement,
      params: [collectionId],
      type: "update",
    });
  }

  delete(collectionId: string, productId: string): void {
    const statement = this.db.query(
      `DELETE FROM collectionProductsReadModel WHERE collectionId = ? AND productId = ?`,
    );

    this.batch.addCommand({
      statement,
      params: [collectionId, productId],
      type: "delete",
    });
  }
}
