import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";
import type { DropshipVariantState } from "@/api/domain/dropshipVariant/events";
import type { DigitalDownloadableVariantState, DigitalAsset } from "@/api/domain/digitalDownloadableVariant/events";
import type { ImageCollection } from "@/api/domain/_base/imageCollection";
import type { ProductStatus } from "@/api/domain/product/aggregate";
import type { VariantStatus, SaleType } from "@/api/domain/variant/aggregate";

type AllVariantState = DropshipVariantState | DigitalDownloadableVariantState;

function calculateActivePrice(listPrice: number, saleType: SaleType | null, saleValue: number | null): number {
  if (saleType === null || saleValue === null) {
    return listPrice;
  }
  switch (saleType) {
    case "fixed":
      return saleValue;
    case "percent":
      return Math.round(listPrice * (1 - saleValue));
    case "amount":
      return Math.max(0, listPrice - saleValue);
  }
}

export type ProductVariantEntry = {
  productId: string;
  variantId: string;
  position: number;
  // Variant fields
  sku: string;
  listPrice: number;
  saleType: SaleType | null;
  saleValue: number | null;
  activePrice: number;
  inventory: number;
  options: Record<string, string>;
  variantStatus: VariantStatus;
  images: ImageCollection;
  digitalAsset: DigitalAsset | null;
  variantFulfillmentProviderId?: string | null;
  variantSupplierCost?: number | null;
  variantSupplierSku?: string | null;
  variantMaxDownloads?: number | null;
  variantAccessDurationDays?: number | null;
  variantCreatedAt: Date;
  variantUpdatedAt: Date;
  variantPublishedAt: Date | null;
  // Product fields (full denormalization)
  productName: string;
  productSlug: string;
  productDescription: string;
  productStatus: ProductStatus;
  productVendor: string;
  productType: "digital" | "dropship";
  dropshipSafetyBuffer?: number;
  fulfillmentProviderId?: string | null;
  supplierCost?: number | null;
  supplierSku?: string | null;
  maxDownloads?: number | null;
  accessDurationDays?: number | null;
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
  productStatus: ProductStatus;
  productVendor: string;
  productType: "digital" | "dropship";
  dropshipSafetyBuffer?: number;
  fulfillmentProviderId?: string | null;
  supplierCost?: number | null;
  supplierSku?: string | null;
  maxDownloads?: number | null;
  accessDurationDays?: number | null;
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
        sku, listPrice, saleType, saleValue, activePrice, inventory, options, variantStatus, images, digitalAsset,
        variantFulfillmentProviderId, variantSupplierCost, variantSupplierSku,
        variantMaxDownloads, variantAccessDurationDays,
        variantCreatedAt, variantUpdatedAt, variantPublishedAt,
        productName, productSlug, productDescription, productStatus, productVendor,
        productType, dropshipSafetyBuffer, fulfillmentProviderId, supplierCost, supplierSku,
        maxDownloads, accessDurationDays,
        defaultVariantId, variantOptions,
        collections, tags, taxable, taxId, metaTitle, metaDescription,
        richDescriptionUrl, productCreatedAt, productUpdatedAt, productPublishedAt,
        variantCorrelationId, variantVersion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.batch.addCommand({
      statement,
      params: [
        entry.productId,
        entry.variantId,
        entry.position,
        entry.sku,
        entry.listPrice,
        entry.saleType,
        entry.saleValue,
        entry.activePrice,
        entry.inventory,
        JSON.stringify(entry.options),
        entry.variantStatus,
        JSON.stringify(entry.images),
        entry.digitalAsset ? JSON.stringify(entry.digitalAsset) : null,
        entry.variantFulfillmentProviderId ?? null,
        entry.variantSupplierCost ?? null,
        entry.variantSupplierSku ?? null,
        entry.variantMaxDownloads ?? null,
        entry.variantAccessDurationDays ?? null,
        entry.variantCreatedAt.toISOString(),
        entry.variantUpdatedAt.toISOString(),
        entry.variantPublishedAt?.toISOString() ?? null,
        entry.productName,
        entry.productSlug,
        entry.productDescription,
        entry.productStatus,
        entry.productVendor,
        entry.productType,
        entry.dropshipSafetyBuffer ?? null,
        entry.fulfillmentProviderId ?? null,
        entry.supplierCost ?? null,
        entry.supplierSku ?? null,
        entry.maxDownloads ?? null,
        entry.accessDurationDays ?? null,
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
    variantState: AllVariantState & { correlationId: string; version: number },
    productFields: ProductFieldsForVariant,
  ): void {
    this.save({
      productId: variantState.productId,
      variantId,
      position: 0, // Default, updated by positions projector
      sku: variantState.sku,
      listPrice: variantState.listPrice,
      saleType: variantState.saleType,
      saleValue: variantState.saleValue,
      activePrice: calculateActivePrice(variantState.listPrice, variantState.saleType, variantState.saleValue),
      inventory: variantState.inventory,
      options: variantState.options,
      variantStatus: variantState.status,
      images: variantState.images,
      digitalAsset: variantState.variantType === "digital_downloadable" ? variantState.digitalAsset : null,
      variantFulfillmentProviderId: variantState.variantType === "dropship" ? variantState.fulfillmentProviderId : null,
      variantSupplierCost: variantState.variantType === "dropship" ? variantState.supplierCost : null,
      variantSupplierSku: variantState.variantType === "dropship" ? variantState.supplierSku : null,
      variantMaxDownloads: variantState.variantType === "digital_downloadable" ? variantState.maxDownloads : null,
      variantAccessDurationDays: variantState.variantType === "digital_downloadable" ? variantState.accessDurationDays : null,
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
        productType = ?,
        dropshipSafetyBuffer = ?,
        fulfillmentProviderId = ?,
        supplierCost = ?,
        supplierSku = ?,
        maxDownloads = ?,
        accessDurationDays = ?,
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
        productFields.productType,
        productFields.dropshipSafetyBuffer ?? null,
        productFields.fulfillmentProviderId ?? null,
        productFields.supplierCost ?? null,
        productFields.supplierSku ?? null,
        productFields.maxDownloads ?? null,
        productFields.accessDurationDays ?? null,
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
        name, slug, description, status, vendor, productType,
        dropshipSafetyBuffer, fulfillmentProviderId, supplierCost, supplierSku,
        maxDownloads, accessDurationDays,
        variantOptions, collections, tags,
        taxable, taxId, metaTitle, metaDescription, richDescriptionUrl,
        defaultVariantId, createdAt, updatedAt, publishedAt
      FROM productReadModel WHERE aggregateId = ?`
    ).get(productId) as {
      name: string;
      slug: string;
      description: string;
      status: "draft" | "active" | "archived";
      vendor: string;
      productType: "digital" | "dropship";
      dropshipSafetyBuffer: number | null;
      fulfillmentProviderId: string | null;
      supplierCost: number | null;
      supplierSku: string | null;
      maxDownloads: number | null;
      accessDurationDays: number | null;
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
      productType: row.productType,
      dropshipSafetyBuffer: row.dropshipSafetyBuffer ?? undefined,
      fulfillmentProviderId: row.fulfillmentProviderId,
      supplierCost: row.supplierCost,
      supplierSku: row.supplierSku,
      maxDownloads: row.maxDownloads,
      accessDurationDays: row.accessDurationDays,
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
