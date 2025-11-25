import type { Database, SQLQueryBindings } from "bun:sqlite";

type QueryResult<T> = { success: true; data: T } | { success: false; error: Error };

type ProductListParams = {
  productId?: string;
  status?: "draft" | "active" | "archived";
  limit?: number;
  offset?: number;
};

type ProductCollectionsParams = {
  collectionId?: string;
  productId?: string;
  limit?: number;
  offset?: number;
};

type ProductVariantsParams = {
  productId?: string;
  variantId?: string;
  limit?: number;
  offset?: number;
};

type CollectionsParams = {
  collectionId?: string;
  status?: "draft" | "active" | "archived";
  limit?: number;
  offset?: number;
};

type SchedulesParams = {
  targetAggregateId?: string;
  status?: "pending" | "completed" | "failed" | "cancelled";
  limit?: number;
  offset?: number;
};

type VariantsParams = {
  productId?: string;
  variantId?: string;
  status?: "draft" | "active" | "archived";
  limit?: number;
  offset?: number;
};

type SlugRedirectsParams = {
  oldSlug?: string;
  newSlug?: string;
  entityId?: string;
  entityType?: "product" | "collection";
  limit?: number;
  offset?: number;
};

type SlugRedirectChainParams = {
  entityId: string;
  entityType: "product" | "collection";
};

export function createAdminQueriesRouter(db: Database) {
  return async (type: string, params: unknown): Promise<QueryResult<unknown>> => {
    try {
      switch (type) {
        case 'productListView': {
          const p = (params || {}) as ProductListParams;
          let query = 'SELECT * FROM product_list_read_model WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.productId) {
            query += ' AND aggregate_id = ?';
            queryParams.push(p.productId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY created_at DESC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'productCollectionsView': {
          const p = (params || {}) as ProductCollectionsParams;
          let query = 'SELECT * FROM product_collections WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.collectionId) {
            query += ' AND collection_id = ?';
            queryParams.push(p.collectionId);
          }
          if (p.productId) {
            query += ' AND aggregate_id = ?';
            queryParams.push(p.productId);
          }
          query += ' ORDER BY created_at DESC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'productVariantsView': {
          const p = (params || {}) as ProductVariantsParams;
          let query = 'SELECT * FROM product_variants WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.productId) {
            query += ' AND aggregate_id = ?';
            queryParams.push(p.productId);
          }
          if (p.variantId) {
            query += ' AND variant_id = ?';
            queryParams.push(p.variantId);
          }
          query += ' ORDER BY created_at DESC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'collectionsView': {
          const p = (params || {}) as CollectionsParams;
          let query = 'SELECT * FROM collections_list_read_model WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.collectionId) {
            query += ' AND aggregate_id = ?';
            queryParams.push(p.collectionId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY created_at DESC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'schedulesView': {
          const p = (params || {}) as SchedulesParams;
          let query = 'SELECT * FROM schedules_read_model WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.targetAggregateId) {
            query += ' AND target_aggregate_id = ?';
            queryParams.push(p.targetAggregateId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY scheduled_for ASC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'variantsView': {
          const p = (params || {}) as VariantsParams;
          let query = 'SELECT * FROM variant_details_read_model WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.productId) {
            query += ' AND product_id = ?';
            queryParams.push(p.productId);
          }
          if (p.variantId) {
            query += ' AND aggregate_id = ?';
            queryParams.push(p.variantId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY created_at DESC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'slugRedirectsView': {
          const p = (params || {}) as SlugRedirectsParams;
          let query = 'SELECT * FROM slug_redirects WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.oldSlug) {
            query += ' AND old_slug = ?';
            queryParams.push(p.oldSlug);
          }
          if (p.newSlug) {
            query += ' AND new_slug = ?';
            queryParams.push(p.newSlug);
          }
          if (p.entityId) {
            query += ' AND entity_id = ?';
            queryParams.push(p.entityId);
          }
          if (p.entityType) {
            query += ' AND entity_type = ?';
            queryParams.push(p.entityType);
          }
          query += ' ORDER BY created_at DESC';
          if (p.limit) {
            query += ' LIMIT ?';
            queryParams.push(p.limit);
          }
          if (p.offset) {
            query += ' OFFSET ?';
            queryParams.push(p.offset);
          }

          const results = db.query(query).all(...queryParams);
          return { success: true, data: results };
        }

        case 'slugRedirectChain': {
          const p = params as SlugRedirectChainParams;
          // Get all redirects for this entity, ordered by created_at (oldest first)
          // This returns the chain of previous slugs
          const redirects = db.query(`
            SELECT old_slug as slug, created_at
            FROM slug_redirects
            WHERE entity_id = ? AND entity_type = ?
            ORDER BY created_at ASC
          `).all(p.entityId, p.entityType);
          return { success: true, data: redirects };
        }

        default:
          return { success: false, error: new Error(`Unknown query type: ${type}`) };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  };
}
