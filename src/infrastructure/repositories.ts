import type { LuaTransaction } from "./redis";
import type {
  DomainEvent,
  DomainEventPayload,
} from "../domain/_base/domainEvent";

export class EventRepository {
  constructor(private tx: LuaTransaction) {
    this.tx = tx;
  }

  add(event: DomainEvent<string, DomainEventPayload>): void {
    this.tx.addToPerAggregateStream(event.aggregateId, event.version, event);
  }
}

export class AggregateTypeRepository {
  constructor(private tx: LuaTransaction) {
    this.tx = tx;
  }

  add(event: DomainEvent<string, DomainEventPayload>): void {
    this.tx.addToAggregateTypeStream(event.aggregateId, event.version, event);
  }
}
