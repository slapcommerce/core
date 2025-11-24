import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../transactionBatch";
import type { DomainEvent, DomainEventUnion } from "../../domain/_base/domainEvent";

export class EventRepository {
  private db: Database;
  private batch: TransactionBatch;
  public readonly uncommittedEvents: DomainEventUnion[] = [];

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  addEvent(event: DomainEventUnion) {
    // Track the event for projection routing
    this.uncommittedEvents.push(event);
    // Prepare the statement and queue it for execution
    const statement = this.db.query(
      `INSERT INTO events (event_type, version, aggregate_id, correlation_id, occurred_at, user_id, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    this.batch.addCommand({
      statement,
      params: [
        event.eventName,
        event.version,
        event.aggregateId,
        event.correlationId,
        event.occurredAt.toISOString(),
        event.userId,
        JSON.stringify(event.payload),
      ],
      type: "insert",
    });
  }

  getEvents(
    aggregateId: string,
  ): DomainEvent[] {
    const events = this.db
      .query(`SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC`)
      .all(aggregateId) as Array<{
      event_type: string;
      version: number;
      aggregate_id: string;
      correlation_id: string;
      occurred_at: string;
      user_id: string;
      payload: string;
    }>;

    return events.map((event) => ({
      eventName: event.event_type,
      version: event.version,
      aggregateId: event.aggregate_id,
      correlationId: event.correlation_id,
      occurredAt: new Date(event.occurred_at),
      userId: event.user_id,
      payload: JSON.parse(event.payload),
    })) as DomainEvent[];
  }
}
