import type { Database } from "bun:sqlite"

export type SlugRedirectsViewParams = {
  oldSlug?: string
  newSlug?: string
  productId?: string
  limit?: number
  offset?: number
}

export function getSlugRedirectsView(db: Database, params?: SlugRedirectsViewParams) {
  let query = `SELECT * FROM slug_redirects WHERE 1=1`
  const queryParams: (string | number)[] = []

  if (params?.oldSlug) {
    query += ` AND old_slug = ?`
    queryParams.push(params.oldSlug)
  }
  if (params?.newSlug) {
    query += ` AND new_slug = ?`
    queryParams.push(params.newSlug)
  }
  if (params?.productId) {
    query += ` AND product_id = ?`
    queryParams.push(params.productId)
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
    old_slug: string
    new_slug: string
    product_id: string
    created_at: string
  }>

  return rows.map(row => ({
    old_slug: row.old_slug,
    new_slug: row.new_slug,
    product_id: row.product_id,
    created_at: row.created_at,
  }))
}

