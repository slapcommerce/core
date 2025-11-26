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
  aggregateId?: string;
  aggregateType?: "product" | "collection";
  limit?: number;
  offset?: number;
};

type SlugRedirectChainParams = {
  aggregateId: string;
  aggregateType: "product" | "collection";
};

export function createAdminQueriesRouter(db: Database) {
  return async (type: string, params: unknown): Promise<QueryResult<unknown>> => {
    try {
      switch (type) {
        case 'productListView': {
          const p = (params || {}) as ProductListParams;
          let query = 'SELECT * FROM productReadModel WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.productId) {
            query += ' AND aggregateId = ?';
            queryParams.push(p.productId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY createdAt DESC';
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
          let query = 'SELECT * FROM productCollections WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.collectionId) {
            query += ' AND collectionId = ?';
            queryParams.push(p.collectionId);
          }
          if (p.productId) {
            query += ' AND aggregateId = ?';
            queryParams.push(p.productId);
          }
          query += ' ORDER BY createdAt DESC';
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
          let query = 'SELECT * FROM productVariants WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.productId) {
            query += ' AND aggregateId = ?';
            queryParams.push(p.productId);
          }
          if (p.variantId) {
            query += ' AND variantId = ?';
            queryParams.push(p.variantId);
          }
          query += ' ORDER BY createdAt DESC';
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
          let query = 'SELECT * FROM collectionsReadModel WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.collectionId) {
            query += ' AND aggregateId = ?';
            queryParams.push(p.collectionId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY createdAt DESC';
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
          let query = 'SELECT * FROM schedulesReadModel WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.targetAggregateId) {
            query += ' AND targetAggregateId = ?';
            queryParams.push(p.targetAggregateId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY scheduledFor ASC';
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
          let query = 'SELECT * FROM variantDetailsReadModel WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.productId) {
            query += ' AND productId = ?';
            queryParams.push(p.productId);
          }
          if (p.variantId) {
            query += ' AND aggregateId = ?';
            queryParams.push(p.variantId);
          }
          if (p.status) {
            query += ' AND status = ?';
            queryParams.push(p.status);
          }
          query += ' ORDER BY createdAt DESC';
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
          let query = 'SELECT * FROM slugRedirects WHERE 1=1';
          const queryParams: SQLQueryBindings[] = [];

          if (p.oldSlug) {
            query += ' AND oldSlug = ?';
            queryParams.push(p.oldSlug);
          }
          if (p.newSlug) {
            query += ' AND newSlug = ?';
            queryParams.push(p.newSlug);
          }
          if (p.aggregateId) {
            query += ' AND aggregateId = ?';
            queryParams.push(p.aggregateId);
          }
          if (p.aggregateType) {
            query += ' AND aggregateType = ?';
            queryParams.push(p.aggregateType);
          }
          query += ' ORDER BY createdAt DESC';
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
          // Get all redirects for this aggregate, ordered by createdAt (oldest first)
          // This returns the chain of previous slugs
          const redirects = db.query(`
            SELECT oldSlug as slug, createdAt
            FROM slugRedirects
            WHERE aggregateId = ? AND aggregateType = ?
            ORDER BY createdAt ASC
          `).all(p.aggregateId, p.aggregateType);
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
