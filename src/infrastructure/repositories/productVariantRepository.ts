import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"
import type { ProductListViewData } from "./productListViewRepository"

export class ProductVariantRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    save(data: ProductListViewData, variantId: string) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE since (aggregate_id, variant_id) is composite primary key
        const statement = this.db.query(
            `INSERT OR REPLACE INTO product_variants (
                aggregate_id, variant_id, title, slug, vendor, product_type, short_description,
                tags, created_at, status, correlation_id, version, updated_at, meta_title, meta_description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                data.aggregate_id,
                variantId,
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
            `DELETE FROM product_variants WHERE aggregate_id = ?`
        )

        this.batch.addCommand({
            statement,
            params: [productId],
            type: 'delete'
        })
    }

    deleteByVariant(variantId: string) {
        const statement = this.db.query(
            `DELETE FROM product_variants WHERE variant_id = ?`
        )

        this.batch.addCommand({
            statement,
            params: [variantId],
            type: 'delete'
        })
    }

    findByProduct(productId: string): Array<{ variantId: string; data: ProductListViewData }> {
        // Join with product_list_view to get collection_ids
        const rows = this.db.query(
            `SELECT pv.variant_id, pv.aggregate_id, pv.title, pv.slug, pv.vendor, pv.product_type, pv.short_description,
                    pv.tags, pv.created_at, pv.status, pv.correlation_id, pv.version, pv.updated_at,
                    plv.collection_ids, pv.meta_title, pv.meta_description
             FROM product_variants pv
             JOIN product_list_view plv ON pv.aggregate_id = plv.aggregate_id
             WHERE pv.aggregate_id = ?`
        ).all(productId) as Array<{
            variant_id: string
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
            variantId: row.variant_id,
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

    findByVariant(variantId: string): ProductListViewData[] {
        // Join with product_list_view to get collection_ids
        const rows = this.db.query(
            `SELECT pv.aggregate_id, pv.title, pv.slug, pv.vendor, pv.product_type, pv.short_description,
                    pv.tags, pv.created_at, pv.status, pv.correlation_id, pv.version, pv.updated_at,
                    plv.collection_ids, pv.meta_title, pv.meta_description
             FROM product_variants pv
             JOIN product_list_view plv ON pv.aggregate_id = plv.aggregate_id
             WHERE pv.variant_id = ?`
        ).all(variantId) as Array<{
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
}

