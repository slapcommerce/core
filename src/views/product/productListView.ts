import type { Database } from "bun:sqlite"
import { safeJsonParse } from "../../lib/utils"

export type ProductListViewParams = {
  status?: "draft" | "active" | "archived"
  vendor?: string
  productType?: string
  collectionId?: string
  limit?: number
  offset?: number
}

export function getProductListView(db: Database, params?: ProductListViewParams) {
  let query: string
  const queryParams: (string | number)[] = []

  if (params?.collectionId) {
    // Use json_each to efficiently find products containing the collection ID
    query = `SELECT DISTINCT p.* FROM product_list_view p, json_each(p.collection_ids) AS j WHERE j.value = ?`
    queryParams.push(params.collectionId)

    if (params?.status) {
      query += ` AND p.status = ?`
      queryParams.push(params.status)
    }
    if (params?.vendor) {
      query += ` AND p.vendor = ?`
      queryParams.push(params.vendor)
    }
    if (params?.productType) {
      query += ` AND p.product_type = ?`
      queryParams.push(params.productType)
    }
  } else {
    query = `SELECT * FROM product_list_view WHERE 1=1`

    if (params?.status) {
      query += ` AND status = ?`
      queryParams.push(params.status)
    }
    if (params?.vendor) {
      query += ` AND vendor = ?`
      queryParams.push(params.vendor)
    }
    if (params?.productType) {
      query += ` AND product_type = ?`
      queryParams.push(params.productType)
    }
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
    title: string
    slug: string
    vendor: string
    product_type: string
    short_description: string
    tags: string
    created_at: string
    status: "draft" | "active" | "archived"
    correlation_id: string
    version: number
    updated_at: string
    collection_ids: string
    meta_title: string
    meta_description: string
    taxable: number
    requires_shipping: number
    page_layout_id: string | null
    fulfillment_type: string
    digital_asset_url: string | null
    max_licenses: number | null
    dropship_safety_buffer: number | null
    variant_options: string
  }>

  return rows.map(row => ({
    aggregate_id: row.aggregate_id,
    title: row.title,
    slug: row.slug,
    vendor: row.vendor,
    product_type: row.product_type,
    short_description: row.short_description,
    tags: safeJsonParse(row.tags, []),
    created_at: row.created_at,
    status: row.status,
    correlation_id: row.correlation_id,
    version: row.version,
    updated_at: row.updated_at,
    collection_ids: safeJsonParse(row.collection_ids, []),
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    taxable: row.taxable,
    requires_shipping: row.requires_shipping,
    page_layout_id: row.page_layout_id,
    fulfillment_type: row.fulfillment_type as "physical" | "digital" | "dropship",
    digital_asset_url: row.digital_asset_url,
    max_licenses: row.max_licenses,
    dropship_safety_buffer: row.dropship_safety_buffer,
    variant_options: safeJsonParse(row.variant_options, []),
  }))
}

