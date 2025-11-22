import type { Database } from "bun:sqlite"

import { GetProductVariantsQuery } from "./queries"

export function getProductVariantsView(db: Database, params?: GetProductVariantsQuery) {
  let query = `SELECT * FROM product_variants WHERE 1=1`
  const queryParams: (string | number)[] = []

  if (params?.productId) {
    query += ` AND aggregate_id = ?`
    queryParams.push(params.productId)
  }
  if (params?.variantId) {
    query += ` AND variant_id = ?`
    queryParams.push(params.variantId)
  }
  if (params?.status) {
    query += ` AND status = ?`
    queryParams.push(params.status)
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
    variant_id: string
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
  }>

  return rows.map(row => ({
    aggregate_id: row.aggregate_id,
    variant_id: row.variant_id,
    title: row.title,
    slug: row.slug,
    vendor: row.vendor,
    product_type: row.product_type,
    short_description: row.short_description,
    tags: JSON.parse(row.tags) as string[],
    created_at: row.created_at,
    status: row.status,
    correlation_id: row.correlation_id,
    version: row.version,
    updated_at: row.updated_at,
  }))
}

