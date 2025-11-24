import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type VariantDetailsViewData = {
  aggregate_id: string
  product_id: string
  sku: string
  price: number
  inventory: number
  options: string
  status: "draft" | "active" | "archived"
  correlation_id: string
  version: number
  created_at: Date
  updated_at: Date
  images: string | null
  digital_asset: string | null
}

export class VariantDetailsViewRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(data: VariantDetailsViewData) {
    // Prepare the statement and queue it for execution
    // Use INSERT OR REPLACE since aggregate_id is primary key
    const statement = this.db.query(
      `INSERT OR REPLACE INTO variant_details_view (
        aggregate_id, product_id, sku, price, inventory, options, status, correlation_id, version, created_at, updated_at, images, digital_asset
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        data.aggregate_id,
        data.product_id,
        data.sku,
        data.price,
        data.inventory,
        data.options,
        data.status,
        data.correlation_id,
        data.version,
        data.created_at.toISOString(),
        data.updated_at.toISOString(),
        data.images,
        data.digital_asset,
      ],
      type: 'insert'
    })
  }

  findByVariantId(variantId: string): VariantDetailsViewData | null {
    const row = this.db.query(
      `SELECT aggregate_id, product_id, sku, price, inventory, options, status, correlation_id, version, created_at, updated_at, images, digital_asset
       FROM variant_details_view
       WHERE aggregate_id = ?`
    ).get(variantId) as {
      aggregate_id: string
      product_id: string
      sku: string
      price: number
      inventory: number
      options: string
      status: "draft" | "active" | "archived"
      correlation_id: string
      version: number
      created_at: string
      updated_at: string
      images: string | null
      digital_asset: string | null
    } | null

    if (!row) {
      return null
    }

    return {
      aggregate_id: row.aggregate_id,
      product_id: row.product_id,
      sku: row.sku,
      price: row.price,
      inventory: row.inventory,
      options: row.options,
      status: row.status,
      correlation_id: row.correlation_id,
      version: row.version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      images: row.images,
      digital_asset: row.digital_asset,
    }
  }

  findByProductId(productId: string): VariantDetailsViewData[] {
    const rows = this.db.query(
      `SELECT aggregate_id, product_id, sku, price, inventory, options, status, correlation_id, version, created_at, updated_at, images, digital_asset
       FROM variant_details_view
       WHERE product_id = ?`
    ).all(productId) as {
      aggregate_id: string
      product_id: string
      sku: string
      price: number
      inventory: number
      options: string
      status: "draft" | "active" | "archived"
      correlation_id: string
      version: number
      created_at: string
      updated_at: string
      images: string | null
      digital_asset: string | null
    }[]

    return rows.map(row => ({
      aggregate_id: row.aggregate_id,
      product_id: row.product_id,
      sku: row.sku,
      price: row.price,
      inventory: row.inventory,
      options: row.options,
      status: row.status,
      correlation_id: row.correlation_id,
      version: row.version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      images: row.images,
      digital_asset: row.digital_asset,
    }))
  }

  deleteByVariant(variantId: string) {
    const statement = this.db.query(
      `DELETE FROM variant_details_view WHERE aggregate_id = ?`
    )

    this.batch.addCommand({
      statement,
      params: [variantId],
      type: 'delete'
    })
  }
}