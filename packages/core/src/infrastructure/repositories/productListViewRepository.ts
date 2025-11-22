import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

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
    taxable: number; // boolean stored as 0/1
    fulfillment_type: "physical" | "digital" | "dropship";
    dropship_safety_buffer: number | null;
    variant_options: { name: string; values: string[] }[];
    version: number
    updated_at: Date
    collection_ids: string[]
    meta_title: string
    meta_description: string
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
                tags, created_at, status, correlation_id, taxable,
                fulfillment_type, dropship_safety_buffer,
                variant_options, version, updated_at, collection_ids, meta_title, meta_description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
                JSON.stringify(data.tags || []),
                data.created_at.toISOString(),
                data.status,
                data.correlation_id,
                data.taxable,
                data.fulfillment_type,
                data.dropship_safety_buffer,
                JSON.stringify(data.variant_options || []),
                data.version,
                data.updated_at.toISOString(),
                JSON.stringify(data.collection_ids || []),
                data.meta_title,
                data.meta_description,
            ],
            type: 'insert'
        })
    }

    findByProductId(productId: string): ProductListViewData | null {
        const row = this.db.query(
            `SELECT aggregate_id, title, slug, vendor, product_type, short_description,
                    tags, created_at, status, correlation_id, taxable,
                    fulfillment_type, dropship_safety_buffer,
                    variant_options, version, updated_at, collection_ids, meta_title, meta_description
             FROM product_list_view
             WHERE aggregate_id = ?`
        ).get(productId) as {
            aggregate_id: string
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
            collection_ids: string
            meta_title: string
            meta_description: string
            taxable: number
            fulfillment_type: string
            dropship_safety_buffer: number | null
            variant_options: string
        } | null

        if (!row) {
            return null
        }

        return {
            aggregate_id: row.aggregate_id,
            title: row.title,
            slug: row.slug,
            vendor: row.vendor,
            product_type: row.product_type,
            short_description: row.short_description,
            tags: JSON.parse(row.tags) as string[],
            created_at: new Date(row.created_at),
            status: row.status,
            correlation_id: row.correlation_id,
            version: row.version,
            updated_at: new Date(row.updated_at),
            collection_ids: JSON.parse(row.collection_ids) as string[],
            meta_title: row.meta_title,
            meta_description: row.meta_description,
            taxable: row.taxable,
            fulfillment_type: row.fulfillment_type as "physical" | "digital" | "dropship",
            dropship_safety_buffer: row.dropship_safety_buffer,
            variant_options: JSON.parse(row.variant_options) as { name: string; values: string[] }[],
        }
    }

    findByCollectionId(collectionId: string): ProductListViewData[] {
        // Use json_each to efficiently find products containing the collection ID
        const rows = this.db.query(
            `SELECT DISTINCT p.aggregate_id, p.title, p.slug, p.vendor, p.product_type, p.short_description,
                    p.tags, p.created_at, p.status, p.correlation_id, p.taxable,
                    p.fulfillment_type, p.dropship_safety_buffer,
                    p.variant_options, p.version, p.updated_at, p.collection_ids, p.meta_title, p.meta_description
             FROM product_list_view p,
                  json_each(p.collection_ids) AS j
             WHERE j.value = ?`
        ).all(collectionId) as Array<{
            aggregate_id: string
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
            collection_ids: string
            meta_title: string
            meta_description: string
            taxable: number
            fulfillment_type: string
            dropship_safety_buffer: number | null
            variant_options: string
        }>

        return rows.map(row => ({
            aggregate_id: row.aggregate_id,
            title: row.title,
            slug: row.slug,
            vendor: row.vendor,
            product_type: row.product_type,
            short_description: row.short_description,
            tags: JSON.parse(row.tags) as string[],
            created_at: new Date(row.created_at),
            status: row.status,
            correlation_id: row.correlation_id,
            version: row.version,
            updated_at: new Date(row.updated_at),
            collection_ids: JSON.parse(row.collection_ids) as string[],
            meta_title: row.meta_title,
            meta_description: row.meta_description,
            taxable: row.taxable,
            fulfillment_type: row.fulfillment_type as "physical" | "digital" | "dropship",
            dropship_safety_buffer: row.dropship_safety_buffer,
            variant_options: JSON.parse(row.variant_options) as { name: string; values: string[] }[],
        }))
    }
}