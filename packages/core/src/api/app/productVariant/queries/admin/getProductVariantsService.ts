import type { Database } from "bun:sqlite";
import type { GetProductVariantsQuery } from "./queries";
import type { ProductVariantsView } from "./views";
import { ProductVariantReadModel } from "./views";

export class GetProductVariantsService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  handle(params: GetProductVariantsQuery): ProductVariantsView {
    const { query, queryParams } = this.buildQuery(params);
    const rows = this.db
      .query(query)
      .as(ProductVariantReadModel)
      .all(...queryParams);
    return rows;
  }

  private buildQuery(params: GetProductVariantsQuery) {
    let query = `SELECT * FROM productVariantsReadModel WHERE productId = ?`;
    const queryParams: (string | number)[] = [params.productId];

    if (params.status) {
      query += ` AND variantStatus = ?`;
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
