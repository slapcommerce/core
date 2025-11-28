import type { Database } from "bun:sqlite";
import type { GetCollectionProductsQuery } from "./queries";
import type { CollectionProductsView } from "./views";
import { CollectionProductReadModel } from "./views";

export class GetCollectionProductsService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  handle(params: GetCollectionProductsQuery): CollectionProductsView {
    const { query, queryParams } = this.buildQuery(params);
    const rows = this.db
      .query(query)
      .as(CollectionProductReadModel)
      .all(...queryParams);
    return rows;
  }

  private buildQuery(params: GetCollectionProductsQuery) {
    let query = `SELECT * FROM collectionProductsReadModel WHERE collectionId = ?`;
    const queryParams: (string | number)[] = [params.collectionId];

    if (params.status) {
      query += ` AND status = ?`;
      queryParams.push(params.status);
    }

    // Always order by position for consistent ordering
    query += ` ORDER BY position ASC`;

    if (params.limit) {
      query += ` LIMIT ?`;
      queryParams.push(params.limit);
    }
    if (params.offset) {
      if (!params.limit) {
        query += ` LIMIT -1`;
      }
      query += ` OFFSET ?`;
      queryParams.push(params.offset);
    }
    return { query, queryParams };
  }
}
