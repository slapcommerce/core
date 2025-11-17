import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type SkuState = {
  sku: string;
  variantId: string | null;
  status: "active" | "released";
};

export type SkuEventPayload = StateBasedPayload<SkuState>;

type SkuReservedEventType = DomainEvent<
  "sku.reserved",
  SkuEventPayload
>;

type SkuReservedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: SkuState;
  newState: SkuState;
};

export class SkuReservedEvent implements SkuReservedEventType {
  occurredAt: Date;
  eventName = "sku.reserved" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: SkuEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: SkuReservedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type SkuReleasedEventType = DomainEvent<
  "sku.released",
  SkuEventPayload
>;

type SkuReleasedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: SkuState;
  newState: SkuState;
};

export class SkuReleasedEvent implements SkuReleasedEventType {
  occurredAt: Date;
  eventName = "sku.released" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: SkuEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: SkuReleasedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

