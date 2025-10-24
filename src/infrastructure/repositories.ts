import type { LuaCommandTransaction, LuaTransaction } from "./redis";
import type {
  DomainEvent,
  DomainEventPayload,
} from "../domain/_base/domainEvent";
import { encode } from "@msgpack/msgpack";

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

export class SnapshotRepository {
  constructor(private tx: LuaCommandTransaction) {
    this.tx = tx;
  }

  async save(aggregateId: string, version: number, snapshot: any) {
    const buffer = encode(snapshot);
    await this.tx.addSnapshot(aggregateId, version, Buffer.from(buffer));
  }
}
