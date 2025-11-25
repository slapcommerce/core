import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type SlugRedirectReadModel = {
    old_slug: string
    new_slug: string
    entity_id: string
    entity_type: 'product' | 'collection'
    product_id?: string
    created_at: Date
}

export class SlugRedirectRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    save(data: SlugRedirectReadModel) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE since old_slug is primary key
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
                data.product_id || null,
                data.created_at.toISOString(),
            ],
            type: 'insert'
        })
    }

    findByOldSlug(oldSlug: string): SlugRedirectReadModel | null {
        const result = this.db.query(
            `SELECT * FROM slug_redirects WHERE old_slug = ?`
        ).get(oldSlug) as {
            old_slug: string
            new_slug: string
            entity_id: string
            entity_type: 'product' | 'collection'
            product_id: string | null
            created_at: string
        } | null

        if (!result) {
            return null
        }

        return {
            old_slug: result.old_slug,
            new_slug: result.new_slug,
            entity_id: result.entity_id,
            entity_type: result.entity_type,
            product_id: result.product_id || undefined,
            created_at: new Date(result.created_at),
        }
    }

    findByNewSlug(newSlug: string): SlugRedirectReadModel[] {
        const results = this.db.query(
            `SELECT * FROM slug_redirects WHERE new_slug = ?`
        ).all(newSlug) as Array<{
            old_slug: string
            new_slug: string
            entity_id: string
            entity_type: 'product' | 'collection'
            product_id: string | null
            created_at: string
        }>

        return results.map(result => ({
            old_slug: result.old_slug,
            new_slug: result.new_slug,
            entity_id: result.entity_id,
            entity_type: result.entity_type,
            product_id: result.product_id || undefined,
            created_at: new Date(result.created_at),
        }))
    }

    getAll(): SlugRedirectReadModel[] {
        const results = this.db.query(
            `SELECT * FROM slug_redirects`
        ).all() as Array<{
            old_slug: string
            new_slug: string
            entity_id: string
            entity_type: 'product' | 'collection'
            product_id: string | null
            created_at: string
        }>

        return results.map(result => ({
            old_slug: result.old_slug,
            new_slug: result.new_slug,
            entity_id: result.entity_id,
            entity_type: result.entity_type,
            product_id: result.product_id || undefined,
            created_at: new Date(result.created_at),
        }))
    }

    findByEntity(entityId: string, entityType: 'product' | 'collection'): SlugRedirectReadModel[] {
        const results = this.db.query(
            `SELECT * FROM slug_redirects WHERE entity_id = ? AND entity_type = ? ORDER BY created_at ASC`
        ).all(entityId, entityType) as Array<{
            old_slug: string
            new_slug: string
            entity_id: string
            entity_type: 'product' | 'collection'
            product_id: string | null
            created_at: string
        }>

        return results.map(result => ({
            old_slug: result.old_slug,
            new_slug: result.new_slug,
            entity_id: result.entity_id,
            entity_type: result.entity_type,
            product_id: result.product_id || undefined,
            created_at: new Date(result.created_at),
        }))
    }
}

