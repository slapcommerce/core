import type { LuaCommandTransaction, LuaTransaction } from "./redis";
import type {
  DomainEvent,
  DomainEventPayload,
} from "../domain/_base/domainEvent";
import type { AggregateSerializer } from "./aggregateSerializer";
import type { EventSerializer } from "./eventSerializer";
import type redis from "ioredis";
import { RedisPrefix } from "./redis";
import type { DomainAggregate } from "../domain/_base/aggregate";
import { aggregateRegistry } from "../domain/aggregateRegistry";

export class EventRepository {
  constructor(
    private tx: LuaTransaction,
    private eventSerializer: EventSerializer
  ) {
    this.tx = tx;
    this.eventSerializer = eventSerializer;
  }

  async add(event: DomainEvent<string, DomainEventPayload>) {
    const serializedEvent = await this.eventSerializer.serialize(event);
    await this.tx.addToPerAggregateStream(
      event.aggregateId,
      event.version,
      serializedEvent
    );
  }
}

export class AggregateTypeRepository {
  constructor(
    private tx: LuaTransaction,
    private eventSerializer: EventSerializer
  ) {
    this.tx = tx;
    this.eventSerializer = eventSerializer;
  }

  async add(event: DomainEvent<string, DomainEventPayload>) {
    const serializedEvent = await this.eventSerializer.serialize(event);
    await this.tx.addToAggregateTypeStream(event.version, serializedEvent);
  }
}

export class SnapshotRepository {
  constructor(
    private redis: redis,
    private tx: LuaCommandTransaction,
    private aggregateSerializer: AggregateSerializer
  ) {
    this.redis = redis;
    this.tx = tx;
    this.aggregateSerializer = aggregateSerializer;
  }

  async add(
    aggregateId: string,
    version: number,
    snapshot: any,
    aggregateType: string
  ) {
    const serializedSnapshot = await this.aggregateSerializer.serialize(
      snapshot,
      aggregateType
    );
    await this.tx.addSnapshot(aggregateId, version, serializedSnapshot);
  }

  async get(aggregateId: string, DomainAggregate: DomainAggregate) {
    const snapshotKey = `${RedisPrefix.SNAPSHOTS}${DomainAggregate.aggregateType}:${aggregateId}`;
    const snapshot = await this.redis.getBuffer(snapshotKey);
    if (!snapshot) {
      return null;
    }
    return await this.aggregateSerializer.deserialize(snapshot);
  }
}
