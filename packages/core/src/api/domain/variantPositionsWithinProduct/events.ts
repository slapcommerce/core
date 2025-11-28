import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type VariantPositionsWithinProductState = {
  productId: string;
  variantIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

type VariantPositionsWithinProductEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantPositionsWithinProductState;
  newState: VariantPositionsWithinProductState;
};

export class VariantPositionsWithinProductCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variantPositionsWithinProduct.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantPositionsWithinProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPositionsWithinProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class VariantPositionsWithinProductReorderedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variantPositionsWithinProduct.reordered" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantPositionsWithinProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPositionsWithinProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class VariantPositionsWithinProductVariantAddedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variantPositionsWithinProduct.variant_added" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantPositionsWithinProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPositionsWithinProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class VariantPositionsWithinProductVariantRemovedEvent
  implements DomainEvent
{
  occurredAt: Date;
  eventName = "variantPositionsWithinProduct.variant_removed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantPositionsWithinProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPositionsWithinProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class VariantPositionsWithinProductArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variantPositionsWithinProduct.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantPositionsWithinProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPositionsWithinProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

/**
 * Union of all VariantPositionsWithinProduct events
 */
export type VariantPositionsWithinProductEvent =
  | VariantPositionsWithinProductCreatedEvent
  | VariantPositionsWithinProductReorderedEvent
  | VariantPositionsWithinProductVariantAddedEvent
  | VariantPositionsWithinProductVariantRemovedEvent
  | VariantPositionsWithinProductArchivedEvent;
