import type { Database } from "bun:sqlite"
import type { ImageItem } from "../../domain/_base/imageCollection"

export type VariantsViewParams = {
  variantId?: string
  productId?: string
  status?: "draft" | "active" | "archived"
  sku?: string
  limit?: number
  offset?: number
}

export function getVariantsView(db: Database, params?: VariantsViewParams) {
  let query = `SELECT * FROM variant_details_view WHERE 1=1`
  const queryParams: (string | number)[] = []

  if (params?.variantId) {
    query += ` AND aggregate_id = ?`
    queryParams.push(params.variantId)
  }

  if (params?.productId) {
    query += ` AND product_id = ?`
    queryParams.push(params.productId)
  }

  if (params?.status) {
    query += ` AND status = ?`
    queryParams.push(params.status)
  }

  if (params?.sku) {
    query += ` AND sku = ?`
    queryParams.push(params.sku)
  }

  if (params?.limit) {
    query += ` LIMIT ?`
    queryParams.push(params.limit)
  }
  if (params?.offset) {
    if (!params?.limit) {
      query += ` LIMIT -1`
    }
    query += ` OFFSET ?`
    queryParams.push(params.offset)
  }

  const rows = db.query(query).all(...queryParams) as Array<{
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
  }>

  return rows.map(row => ({
    aggregate_id: row.aggregate_id,
    variant_id: row.aggregate_id, // For variants, aggregate_id is the variant_id
    product_id: row.product_id,
    sku: row.sku,
    price: row.price,
    inventory: row.inventory,
    options: JSON.parse(row.options) as Record<string, string>,
    status: row.status,
    correlation_id: row.correlation_id,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images: row.images ? JSON.parse(row.images) as ImageItem[] : [],
    digital_asset: row.digital_asset ? JSON.parse(row.digital_asset) : null,
  }))
}
