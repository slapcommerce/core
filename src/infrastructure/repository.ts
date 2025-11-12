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
                event.occurredAt.toISOString(),
                JSON.stringify(event.payload)
            ],
            type: 'insert'
        })
    }

    getEvents(aggregateId: string): DomainEvent<string, Record<string, unknown>>[] {
        const events = this.db.query(
            `SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC`
        ).all(aggregateId) as Array<{
            event_type: string
            version: number
            aggregate_id: string
            correlation_id: string
            occurred_at: string
            payload: string
        }>

        return events.map(event => ({
            eventName: event.event_type,
            version: event.version,
            aggregateId: event.aggregate_id,
            correlationId: event.correlation_id,
            occurredAt: new Date(event.occurred_at),
            payload: JSON.parse(event.payload)
        })) as DomainEvent<string, Record<string, unknown>>[]
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
        payload: Record<string, unknown>
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
                JSON.stringify(snapshot.payload)
            ],
            type: 'insert'
        })
    }

    getSnapshot(aggregateId: string): {
        aggregate_id: string
        correlation_id: string
        version: number
        payload: string
    } | null {
        const snapshot = this.db.query(
            `SELECT * FROM snapshots WHERE aggregate_id = ?`
        ).get(aggregateId) as {
            aggregate_id: string
            correlation_id: string
            version: number
            payload: string
        } | null

        return snapshot
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
                options?.last_attempt_at?.toISOString() ?? null,
                options?.next_retry_at?.toISOString() ?? null,
                options?.idempotency_key ?? null,
            ],
            type: 'insert'
        })
    }
}

export class ProjectionRepository {
    private db: Database
    private batch: TransactionBatch

    constructor(db: Database, batch: TransactionBatch) {
        this.db = db
        this.batch = batch
    }

    saveProjection(projection: {
        id: string
        projection_type: string
        aggregate_id: string
        correlation_id: string
        version: number
        payload: string
        created_at: number
    }) {
        // Prepare the statement and queue it for execution
        // Use INSERT OR REPLACE to support updating existing projections
        const statement = this.db.query(
            `INSERT OR REPLACE INTO projections (id, projection_type, aggregate_id, correlation_id, version, payload, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        )

        this.batch.addCommand({
            statement,
            params: [
                projection.id,
                projection.projection_type,
                projection.aggregate_id,
                projection.correlation_id,
                projection.version,
                projection.payload,
                projection.created_at
            ],
            type: 'insert'
        })
    }

    getProjection(aggregateId: string, projectionType: string): {
        id: string
        projection_type: string
        aggregate_id: string
        correlation_id: string
        version: number
        payload: string
        created_at: number
    } | null {
        const projection = this.db.query(
            `SELECT * FROM projections WHERE aggregate_id = ? AND projection_type = ?`
        ).get(aggregateId, projectionType) as {
            id: string
            projection_type: string
            aggregate_id: string
            correlation_id: string
            version: number
            payload: string
            created_at: number
        } | null

        return projection
    }
}