import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export class SnapshotRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    saveSnapshot(snapshot: {
        aggregateId: string
        correlationId: string
        version: number
        payload: Record<string, unknown>
    }) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE since snapshots are upserted per aggregate
        const statement = this.db.query(
            `INSERT OR REPLACE INTO snapshots (aggregateId, correlationId, version, payload)
             VALUES (?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                snapshot.aggregateId,
                snapshot.correlationId,
                snapshot.version,
                JSON.stringify(snapshot.payload)
            ],
            type: 'insert'
        })
    }

    getSnapshot(aggregateId: string): {
        aggregateId: string
        correlationId: string
        version: number
        payload: string
    } | null {
        const snapshot = this.db.query(
            `SELECT * FROM snapshots WHERE aggregateId = ?`
        ).get(aggregateId) as {
            aggregateId: string
            correlationId: string
            version: number
            payload: string
        } | null

        return snapshot
    }
}
