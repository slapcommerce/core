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
      `INSERT INTO events (eventType, version, aggregateId, correlationId, occurredAt, userId, payload)
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
      .query(`SELECT * FROM events WHERE aggregateId = ? ORDER BY version ASC`)
      .all(aggregateId) as Array<{
      eventType: string;
      version: number;
      aggregateId: string;
      correlationId: string;
      occurredAt: string;
      userId: string;
      payload: string;
    }>;

    return events.map((event) => ({
      eventName: event.eventType,
      version: event.version,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      occurredAt: new Date(event.occurredAt),
      userId: event.userId,
      payload: JSON.parse(event.payload),
    })) as DomainEvent[];
  }
}
