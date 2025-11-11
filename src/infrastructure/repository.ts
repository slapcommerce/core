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

export class SnapshotRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    saveSnapshot(snapshot: {
        aggregate_id: string
        correlation_id: string
        version: number
        payload: string
    }) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE since snapshots are upserted per aggregate
        const statement = this.db.query(
            `INSERT OR REPLACE INTO snapshots (aggregate_id, correlation_id, version, payload)
             VALUES (?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                snapshot.aggregate_id,
                snapshot.correlation_id,
                snapshot.version,
                snapshot.payload
            ],
            type: 'insert'
        })
    }
}

export class OutboxRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    addOutboxEvent(event: {
        id: string
        aggregate_id: string
        event_type: string
        payload: string
        status?: string
        retry_count?: number
        last_attempt_at?: number | null
        next_retry_at?: number | null
        idempotency_key?: string | null
    }) {
        // Prepare the statement and queue it for execution
        const statement = this.db.query(
            `INSERT INTO outbox (id, aggregate_id, event_type, payload, status, retry_count, last_attempt_at, next_retry_at, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                event.id,
                event.aggregate_id,
                event.event_type,
                event.payload,
                event.status ?? 'pending',
                event.retry_count ?? 0,
                event.last_attempt_at ?? null,
                event.next_retry_at ?? null,
                event.idempotency_key ?? null
            ],
            type: 'insert'
        })
    }
}