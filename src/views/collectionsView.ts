import type { Database } from "bun:sqlite"

export type CollectionsViewParams = {
  collectionId?: string
  status?: "draft" | "active" | "archived"
  limit?: number
  offset?: number
}

export function getCollectionsView(db: Database, params?: CollectionsViewParams) {
  let query = `SELECT * FROM collections_list_view WHERE 1=1`
  const queryParams: (string | number)[] = []

  if (params?.collectionId) {
    query += ` AND aggregate_id = ?`
    queryParams.push(params.collectionId)
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
    name: string
    slug: string
    description: string | null
    status: "draft" | "active" | "archived"
    correlation_id: string
    version: number
    created_at: string
    updated_at: string
    meta_title: string
    meta_description: string
    published_at: string | null
    image_url: string | null
  }>

  return rows.map(row => ({
    aggregate_id: row.aggregate_id,
    collection_id: row.aggregate_id, // For collections, aggregate_id is the collection_id
    title: row.name, // Map name to title for consistency with Collection type
    slug: row.slug,
    vendor: "", // Collections don't have vendor
    product_type: "", // Collections don't have product_type
    short_description: row.description || "", // Map description
    tags: [] as string[], // Collections don't have tags
    created_at: row.created_at,
    status: row.status,
    correlation_id: row.correlation_id,
    version: row.version,
    updated_at: row.updated_at,
    meta_title: row.meta_title ?? "",
    meta_description: row.meta_description ?? "",
    published_at: row.published_at,
    image_url: row.image_url,
  }))
}

