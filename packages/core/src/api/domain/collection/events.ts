import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ImageCollection } from "../_base/imageCollection";

export type CollectionState = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  slug: string;
  version: number;
  status: "draft" | "active" | "archived";
  metaTitle: string;
  metaDescription: string;
  publishedAt: Date | null;
  images: ImageCollection
};


type CollectionCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type CollectionArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionArchivedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type CollectionMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionMetadataUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type CollectionPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionPublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type CollectionSeoMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionSeoMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.seo_metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionSeoMetadataUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type CollectionUnpublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionUnpublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type CollectionImagesUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "collection.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<CollectionState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: CollectionImagesUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


/**
 * Union of all collection events
 */
export type CollectionEvent =
  | CollectionCreatedEvent
  | CollectionArchivedEvent
  | CollectionMetadataUpdatedEvent
  | CollectionPublishedEvent
  | CollectionSeoMetadataUpdatedEvent
  | CollectionUnpublishedEvent
  | CollectionImagesUpdatedEvent;
