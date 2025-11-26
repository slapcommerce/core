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
        retryCount?: number
        lastAttemptAt?: Date | null
        nextRetryAt?: Date | null
        idempotencyKey?: string | null
    }) {
        // Prepare the statement and queue it for execution
        const statement = this.db.query(
            `INSERT INTO outbox (id, aggregateId, eventType, payload, status, retryCount, lastAttemptAt, nextRetryAt, idempotencyKey)
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
                options?.retryCount ?? 0,
                options?.lastAttemptAt?.toISOString() ?? null,
                options?.nextRetryAt?.toISOString() ?? null,
                options?.idempotencyKey ?? null,
            ],
            type: 'insert'
        })
    }
}
