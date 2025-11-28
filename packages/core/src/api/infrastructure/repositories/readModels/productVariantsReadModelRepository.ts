import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";
import type { VariantState, DigitalAsset } from "@/api/domain/variant/events";
import type { ImageCollection } from "@/api/domain/_base/imageCollection";

export type ProductVariantEntry = {
  productId: string;
  variantId: string;
  position: number;
  // Variant fields
  sku: string;
  price: number;
  inventory: number;
  options: Record<string, string>;
  variantStatus: "draft" | "active" | "archived";
  images: ImageCollection;
  digitalAsset: DigitalAsset | null;
  variantCreatedAt: Date;
  variantUpdatedAt: Date;
  variantPublishedAt: Date | null;
  // Product fields (full denormalization)
  productName: string;
  productSlug: string;
  productDescription: string;
  productStatus: "draft" | "active" | "archived";
  productVendor: string;
  fulfillmentType: "digital" | "dropship";
  dropshipSafetyBuffer?: number;
  defaultVariantId: string | null;
  variantOptions: { name: string; values: string[] }[];
  collections: string[];
  tags: string[];
  taxable: boolean;
  taxId: string;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  productCreatedAt: Date;
  productUpdatedAt: Date;
  productPublishedAt: Date | null;
  // Tracking
  variantCorrelationId: string;
  variantVersion: number;
};

export type ProductFieldsForVariant = {
  productName: string;
  productSlug: string;
  productDescription: string;
  productStatus: "draft" | "active" | "archived";
  productVendor: string;
  fulfillmentType: "digital" | "dropship";
  dropshipSafetyBuffer?: number;
  defaultVariantId: string | null;
  variantOptions: { name: string; values: string[] }[];
  collections: string[];
  tags: string[];
  taxable: boolean;
  taxId: string;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  productCreatedAt: Date;
  productUpdatedAt: Date;
  productPublishedAt: Date | null;
};

export class ProductVariantsReadModelRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(entry: ProductVariantEntry): void {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO productVariantsReadModel (
        productId, variantId, position,
        sku, price, inventory, options, variantStatus, images, digitalAsset,
        variantCreatedAt, variantUpdatedAt, variantPublishedAt,
        productName, productSlug, productDescription, productStatus, productVendor,
        fulfillmentType, dropshipSafetyBuffer, defaultVariantId, variantOptions,
        collections, tags, taxable, taxId, metaTitle, metaDescription,
        richDescriptionUrl, productCreatedAt, productUpdatedAt, productPublishedAt,
        variantCorrelationId, variantVersion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.batch.addCommand({
      statement,
      params: [
        entry.productId,
        entry.variantId,
        entry.position,
        entry.sku,
        entry.price,
        entry.inventory,
        JSON.stringify(entry.options),
        entry.variantStatus,
        JSON.stringify(entry.images),
        entry.digitalAsset ? JSON.stringify(entry.digitalAsset) : null,
        entry.variantCreatedAt.toISOString(),
        entry.variantUpdatedAt.toISOString(),
        entry.variantPublishedAt?.toISOString() ?? null,
        entry.productName,
        entry.productSlug,
        entry.productDescription,
        entry.productStatus,
        entry.productVendor,
        entry.fulfillmentType,
        entry.dropshipSafetyBuffer ?? null,
        entry.defaultVariantId,
        JSON.stringify(entry.variantOptions),
        JSON.stringify(entry.collections),
        JSON.stringify(entry.tags),
        entry.taxable ? 1 : 0,
        entry.taxId,
        entry.metaTitle,
        entry.metaDescription,
        entry.richDescriptionUrl,
        entry.productCreatedAt.toISOString(),
        entry.productUpdatedAt.toISOString(),
        entry.productPublishedAt?.toISOString() ?? null,
        entry.variantCorrelationId,
        entry.variantVersion,
      ],
      type: "insert",
    });
  }

  saveFromVariantState(
    variantId: string,
    variantState: VariantState & { correlationId: string; version: number },
    productFields: ProductFieldsForVariant,
  ): void {
    this.save({
      productId: variantState.productId,
      variantId,
      position: 0, // Default, updated by positions projector
      sku: variantState.sku,
      price: variantState.price,
      inventory: variantState.inventory,
      options: variantState.options,
      variantStatus: variantState.status,
      images: variantState.images,
      digitalAsset: variantState.digitalAsset,
      variantCreatedAt: variantState.createdAt,
      variantUpdatedAt: variantState.updatedAt,
      variantPublishedAt: variantState.publishedAt,
      ...productFields,
      variantCorrelationId: variantState.correlationId,
      variantVersion: variantState.version,
    });
  }

  updatePositions(
    productId: string,
    positions: Array<{ variantId: string; position: number }>,
  ): void {
    if (positions.length === 0) return;

    // Build CASE statement for efficient bulk update
    const caseStatements = positions
      .map((p) => `WHEN '${p.variantId}' THEN ${p.position}`)
      .join(" ");
    const variantIds = positions.map((p) => `'${p.variantId}'`).join(", ");

    const sql = `
      UPDATE productVariantsReadModel
      SET position = CASE variantId ${caseStatements} END
      WHERE productId = ? AND variantId IN (${variantIds})
    `;

    const statement = this.db.query(sql);
    this.batch.addCommand({
      statement,
      params: [productId],
      type: "update",
    });
  }

  updateProductFields(productId: string, productFields: ProductFieldsForVariant): void {
    const statement = this.db.query(
      `UPDATE productVariantsReadModel SET
        productName = ?,
        productSlug = ?,
        productDescription = ?,
        productStatus = ?,
        productVendor = ?,
        fulfillmentType = ?,
        dropshipSafetyBuffer = ?,
        defaultVariantId = ?,
        variantOptions = ?,
        collections = ?,
        tags = ?,
        taxable = ?,
        taxId = ?,
        metaTitle = ?,
        metaDescription = ?,
        richDescriptionUrl = ?,
        productCreatedAt = ?,
        productUpdatedAt = ?,
        productPublishedAt = ?
      WHERE productId = ?`,
    );

    this.batch.addCommand({
      statement,
      params: [
        productFields.productName,
        productFields.productSlug,
        productFields.productDescription,
        productFields.productStatus,
        productFields.productVendor,
        productFields.fulfillmentType,
        productFields.dropshipSafetyBuffer ?? null,
        productFields.defaultVariantId,
        JSON.stringify(productFields.variantOptions),
        JSON.stringify(productFields.collections),
        JSON.stringify(productFields.tags),
        productFields.taxable ? 1 : 0,
        productFields.taxId,
        productFields.metaTitle,
        productFields.metaDescription,
        productFields.richDescriptionUrl,
        productFields.productCreatedAt.toISOString(),
        productFields.productUpdatedAt.toISOString(),
        productFields.productPublishedAt?.toISOString() ?? null,
        productId,
      ],
      type: "update",
    });
  }

  delete(productId: string, variantId: string): void {
    const statement = this.db.query(
      `DELETE FROM productVariantsReadModel WHERE productId = ? AND variantId = ?`,
    );

    this.batch.addCommand({
      statement,
      params: [productId, variantId],
      type: "delete",
    });
  }

  /**
   * Query product fields from the productReadModel table.
   * Used by the projector to get product data when processing variant events.
   */
  getProductFields(productId: string): ProductFieldsForVariant | null {
    const row = this.db.query(
      `SELECT
        name, slug, description, status, vendor, fulfillmentType,
        dropshipSafetyBuffer, variantOptions, collections, tags,
        taxable, taxId, metaTitle, metaDescription, richDescriptionUrl,
        defaultVariantId, createdAt, updatedAt, publishedAt
      FROM productReadModel WHERE aggregateId = ?`
    ).get(productId) as {
      name: string;
      slug: string;
      description: string;
      status: "draft" | "active" | "archived";
      vendor: string;
      fulfillmentType: "digital" | "dropship";
      dropshipSafetyBuffer: number | null;
      variantOptions: string;
      collections: string;
      tags: string;
      taxable: number;
      taxId: string;
      metaTitle: string;
      metaDescription: string;
      richDescriptionUrl: string;
      defaultVariantId: string | null;
      createdAt: string;
      updatedAt: string;
      publishedAt: string | null;
    } | null;

    if (!row) return null;

    return {
      productName: row.name,
      productSlug: row.slug,
      productDescription: row.description,
      productStatus: row.status,
      productVendor: row.vendor,
      fulfillmentType: row.fulfillmentType,
      dropshipSafetyBuffer: row.dropshipSafetyBuffer ?? undefined,
      defaultVariantId: row.defaultVariantId,
      variantOptions: JSON.parse(row.variantOptions),
      collections: JSON.parse(row.collections),
      tags: JSON.parse(row.tags),
      taxable: row.taxable === 1,
      taxId: row.taxId,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      richDescriptionUrl: row.richDescriptionUrl,
      productCreatedAt: new Date(row.createdAt),
      productUpdatedAt: new Date(row.updatedAt),
      productPublishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
    };
  }
}
