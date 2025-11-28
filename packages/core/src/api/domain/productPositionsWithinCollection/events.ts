import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type ProductPositionsWithinCollectionState = {
  collectionId: string;
  productIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

type ProductPositionsWithinCollectionEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductPositionsWithinCollectionState;
  newState: ProductPositionsWithinCollectionState;
};

export class ProductPositionsWithinCollectionCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "productPositionsWithinCollection.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductPositionsWithinCollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPositionsWithinCollectionEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class ProductPositionsWithinCollectionReorderedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "productPositionsWithinCollection.reordered" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductPositionsWithinCollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPositionsWithinCollectionEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class ProductPositionsWithinCollectionProductAddedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "productPositionsWithinCollection.product_added" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductPositionsWithinCollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPositionsWithinCollectionEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class ProductPositionsWithinCollectionProductRemovedEvent
  implements DomainEvent
{
  occurredAt: Date;
  eventName = "productPositionsWithinCollection.product_removed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductPositionsWithinCollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPositionsWithinCollectionEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class ProductPositionsWithinCollectionArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "productPositionsWithinCollection.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductPositionsWithinCollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPositionsWithinCollectionEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

/**
 * Union of all ProductPositionsWithinCollection events
 */
export type ProductPositionsWithinCollectionEvent =
  | ProductPositionsWithinCollectionCreatedEvent
  | ProductPositionsWithinCollectionReorderedEvent
  | ProductPositionsWithinCollectionProductAddedEvent
  | ProductPositionsWithinCollectionProductRemovedEvent
  | ProductPositionsWithinCollectionArchivedEvent;
