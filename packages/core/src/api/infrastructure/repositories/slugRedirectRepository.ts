import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type SlugRedirectData = {
  old_slug: string;
  new_slug: string;
  entity_id: string;
  entity_type: 'product' | 'collection';
  product_id: string | null;
  created_at: Date;
};

type SlugRedirectRow = {
  old_slug: string;
  new_slug: string;
  entity_id: string;
  entity_type: string;
  product_id: string | null;
  created_at: string;
};

export class SlugRedirectRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(data: SlugRedirectData) {
    const statement = this.db.query(
      `INSERT OR REPLACE INTO slug_redirects (
        old_slug, new_slug, entity_id, entity_type, product_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )

    this.batch.addCommand({
      statement,
      params: [
        data.old_slug,
        data.new_slug,
        data.entity_id,
        data.entity_type,
        data.product_id,
        data.created_at.toISOString(),
      ],
      type: 'insert'
    })
  }

  findByOldSlug(oldSlug: string): SlugRedirectData | null {
    const row = this.db.query(
      `SELECT * FROM slug_redirects WHERE old_slug = ?`
    ).get(oldSlug) as SlugRedirectRow | null;

    if (!row) return null;

    return {
      old_slug: row.old_slug,
      new_slug: row.new_slug,
      entity_id: row.entity_id,
      entity_type: row.entity_type as 'product' | 'collection',
      product_id: row.product_id,
      created_at: new Date(row.created_at),
    };
  }

  findByNewSlug(newSlug: string): SlugRedirectData[] {
    const rows = this.db.query(
      `SELECT * FROM slug_redirects WHERE new_slug = ?`
    ).all(newSlug) as SlugRedirectRow[];

    return rows.map(row => ({
      old_slug: row.old_slug,
      new_slug: row.new_slug,
      entity_id: row.entity_id,
      entity_type: row.entity_type as 'product' | 'collection',
      product_id: row.product_id,
      created_at: new Date(row.created_at),
    }));
  }

  getAll(): SlugRedirectData[] {
    const rows = this.db.query(
      `SELECT * FROM slug_redirects`
    ).all() as SlugRedirectRow[];

    return rows.map(row => ({
      old_slug: row.old_slug,
      new_slug: row.new_slug,
      entity_id: row.entity_id,
      entity_type: row.entity_type as 'product' | 'collection',
      product_id: row.product_id,
      created_at: new Date(row.created_at),
    }));
  }
}
