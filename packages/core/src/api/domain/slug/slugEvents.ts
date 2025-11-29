import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type SlugEntityType = "product" | "bundle" | "collection";

export type SlugState = {
  slug: string;
  entityId: string | null;
  entityType: SlugEntityType | null;
  status: "active" | "redirect";
};



type SlugReservedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: SlugState;
  newState: SlugState;
};

export class SlugReservedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "slug.reserved" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<SlugState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: SlugReservedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type SlugReleasedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: SlugState;
  newState: SlugState;
};

export class SlugReleasedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "slug.released" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<SlugState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: SlugReleasedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type SlugRedirectedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: SlugState;
  newState: SlugState;
};

export class SlugRedirectedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "slug.redirected" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<SlugState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: SlugRedirectedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


/**
 * Union of all slug events
 */
export type SlugEvent =
  | SlugReservedEvent
  | SlugReleasedEvent
  | SlugRedirectedEvent;
