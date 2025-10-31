import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "./transactionBatch"

export class EventRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    addEvent(event: {
        event_type: string
        version: number
        aggregate_id: string
        correlation_id: string
        occurred_at: number
        payload: string
    }) {
        // Prepare the statement and queue it for execution
        const statement = this.db.query(
            `INSERT INTO events (event_type, version, aggregate_id, correlation_id, occurred_at, payload)
             VALUES (?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                event.event_type,
                event.version,
                event.aggregate_id,
                event.correlation_id,
                event.occurred_at,
                event.payload
            ],
            type: 'insert'
        })
    }

}