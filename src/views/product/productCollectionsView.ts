import type { Database } from "bun:sqlite"

export type ProductCollectionsViewParams = {
  collectionId?: string
  aggregateId?: string
  status?: "draft" | "active" | "archived"
  limit?: number
  offset?: number
}

export function getProductCollectionsView(db: Database, params?: ProductCollectionsViewParams) {
  let query = `SELECT * FROM product_collections WHERE 1=1`
  const queryParams: (string | number)[] = []

  if (params?.collectionId) {
    query += ` AND collection_id = ?`
    queryParams.push(params.collectionId)
  }
  if (params?.aggregateId) {
    query += ` AND aggregate_id = ?`
    queryParams.push(params.aggregateId)
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
    collection_id: string
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
    collection_id: row.collection_id,
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

