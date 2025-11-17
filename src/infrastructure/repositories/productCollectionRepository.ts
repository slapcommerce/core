import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"
import type { ProductListViewData } from "./productListViewRepository"

export class ProductCollectionRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    save(data: ProductListViewData, collectionId: string) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE since (aggregate_id, collection_id) is composite primary key
        const statement = this.db.query(
            `INSERT OR REPLACE INTO product_collections (
                aggregate_id, collection_id, title, slug, vendor, product_type, short_description,
                tags, created_at, status, correlation_id, version, updated_at, meta_title, meta_description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                data.aggregate_id,
                collectionId,
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
                data.meta_title,
                data.meta_description,
            ],
            type: 'insert'
        })
    }

    deleteByProduct(productId: string) {
        const statement = this.db.query(
            `DELETE FROM product_collections WHERE aggregate_id = ?`
        )

        this.batch.addCommand({
            statement,
            params: [productId],
            type: 'delete'
        })
    }

    deleteByProductAndCollection(productId: string, collectionId: string) {
        const statement = this.db.query(
            `DELETE FROM product_collections WHERE aggregate_id = ? AND collection_id = ?`
        )

        this.batch.addCommand({
            statement,
            params: [productId, collectionId],
            type: 'delete'
        })
    }

    findByCollection(collectionId: string): ProductListViewData[] {
        // Join with product_list_view to get collection_ids
        const rows = this.db.query(
            `SELECT pc.aggregate_id, pc.title, pc.slug, pc.vendor, pc.product_type, pc.short_description,
                    pc.tags, pc.created_at, pc.status, pc.correlation_id, pc.version, pc.updated_at,
                    plv.collection_ids, pc.meta_title, pc.meta_description
             FROM product_collections pc
             JOIN product_list_view plv ON pc.aggregate_id = plv.aggregate_id
             WHERE pc.collection_id = ?`
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
        }))
    }

    findByProduct(productId: string): Array<{ collectionId: string; data: ProductListViewData }> {
        // Join with product_list_view to get collection_ids
        const rows = this.db.query(
            `SELECT pc.collection_id, pc.aggregate_id, pc.title, pc.slug, pc.vendor, pc.product_type, pc.short_description,
                    pc.tags, pc.created_at, pc.status, pc.correlation_id, pc.version, pc.updated_at,
                    plv.collection_ids, pc.meta_title, pc.meta_description
             FROM product_collections pc
             JOIN product_list_view plv ON pc.aggregate_id = plv.aggregate_id
             WHERE pc.aggregate_id = ?`
        ).all(productId) as Array<{
            collection_id: string
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
        }>

        return rows.map(row => ({
            collectionId: row.collection_id,
            data: {
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
            }
        }))
    }
}

