import type { LuaTransaction } from "./redis";
import type {
  DomainEvent,
  DomainEventPayload,
} from "../domain/_base/domainEvent";

export class EventRepository {
  constructor(private tx: LuaTransaction) {
    this.tx = tx;
  }

  async add(event: DomainEvent<string, DomainEventPayload>) {
    await this.tx.addToPerAggregateStream(
      event.aggregateId,
      event.version,
      event
    );
  }
}

export class AggregateTypeRepository {
  constructor(private tx: LuaTransaction) {
    this.tx = tx;
  }

  async add(event: DomainEvent<string, DomainEventPayload>) {
    await this.tx.addToAggregateTypeStream(event.version, event);
  }
}
