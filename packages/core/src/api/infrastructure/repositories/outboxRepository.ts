import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"
import type { DomainEvent } from "../../domain/_base/domainEvent"
import { randomUUIDv7 } from "bun"

export class OutboxRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    addOutboxEvent(event: DomainEvent, options?: {
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
                options?.last_attempt_at?.toISOString() ?? null,
                options?.next_retry_at?.toISOString() ?? null,
                options?.idempotency_key ?? null,
            ],
            type: 'insert'
        })
    }
}

