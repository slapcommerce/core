import type { Database } from "bun:sqlite"

import { GetSlugRedirectsQuery } from "./queries"

export type SlugRedirect = {
  old_slug: string
  new_slug: string
  entity_id: string
  entity_type: 'product' | 'collection'
  product_id?: string
  created_at: string
}

export function getSlugRedirectsView(db: Database, params?: GetSlugRedirectsQuery): SlugRedirect[] {
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
  if (params?.entityId) {
    query += ` AND entity_id = ?`
    queryParams.push(params.entityId)
  }
  if (params?.entityType) {
    query += ` AND entity_type = ?`
    queryParams.push(params.entityType)
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
    entity_id: string
    entity_type: 'product' | 'collection'
    product_id: string | null
    created_at: string
  }>

  return rows.map(row => ({
    old_slug: row.old_slug,
    new_slug: row.new_slug,
    entity_id: row.entity_id,
    entity_type: row.entity_type,
    product_id: row.product_id || undefined,
    created_at: row.created_at,
  }))
}

export function getSlugRedirectChain(
  db: Database,
  entityId: string,
  entityType: 'product' | 'collection'
): Array<{ slug: string, created_at: string }> {
  // Get all redirects for this entity, ordered by creation date
  const redirects = db.query(
    `SELECT old_slug, created_at FROM slug_redirects 
     WHERE entity_id = ? AND entity_type = ? 
     ORDER BY created_at ASC`
  ).all(entityId, entityType) as Array<{
    old_slug: string
    created_at: string
  }>

  // Convert to chain format with just slug and timestamp
  return redirects.map(redirect => ({
    slug: redirect.old_slug,
    created_at: redirect.created_at,
  }))
}

