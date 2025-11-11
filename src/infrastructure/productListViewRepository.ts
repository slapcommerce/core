import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "./transactionBatch"

export type ProductListViewData = {
    aggregate_id: string
    title: string
    slug: string
    vendor: string
    product_type: string
    short_description: string
    tags: string[]
    created_at: Date
    status: "draft" | "active" | "archived"
    correlation_id: string
    version: number
    updated_at: Date
}

export class ProductListViewRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    save(data: ProductListViewData) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE since aggregate_id is primary key
        const statement = this.db.query(
            `INSERT OR REPLACE INTO product_list_view (
                aggregate_id, title, slug, vendor, product_type, short_description,
                tags, created_at, status, correlation_id, version, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                data.aggregate_id,
                data.title,
                data.slug,
                data.vendor,
                data.product_type,
                data.short_description,
                JSON.stringify(data.tags),
                data.created_at.toISOString(),
                data.status,
                data.correlation_id,
                data.version,
                data.updated_at.toISOString(),
            ],
            type: 'insert'
        })
    }
}

