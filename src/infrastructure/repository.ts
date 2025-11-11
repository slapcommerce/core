import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "./transactionBatch"
import type { DomainEvent } from "../domain/_base/domainEvent"
import { randomUUIDv7 } from "bun"

export class EventRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    addEvent(event: DomainEvent<string, Record<string, unknown>>) {
        // Prepare the statement and queue it for execution
        const statement = this.db.query(
            `INSERT INTO events (event_type, version, aggregate_id, correlation_id, occurred_at, payload)
             VALUES (?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                event.eventName,
                event.version,
                event.aggregateId,
                event.correlationId,
                event.occurredAt.getTime(),
                JSON.stringify(event.payload)
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

    addOutboxEvent(event: DomainEvent<string, Record<string, unknown>>, options?: {
        id?: string
        status?: string
        retry_count?: number
        last_attempt_at?: Date | null
        next_retry_at?: Date | null
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
                options?.id ?? randomUUIDv7(),
                event.aggregateId,
                event.eventName,
                JSON.stringify(event.payload),
                options?.status ?? 'pending',
                options?.retry_count ?? 0,
                options?.last_attempt_at?.getTime() ?? null,
                options?.next_retry_at?.getTime() ?? null,
                options?.idempotency_key ?? null
            ],
            type: 'insert'
        })
    }
}