import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ImageCollection } from "../_base/imageCollection";

export type CollectionState = {
  name: string;
  description: string | null;
  slug: string;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  metaTitle: string;
  metaDescription: string;
  publishedAt: Date | null;
  images: ImageCollection; // Collection of images with alt text
  [key: string]: any;
};

export type CollectionEventPayload = StateBasedPayload<CollectionState>;

type CollectionCreatedEventType = DomainEvent<
  "collection.created",
  CollectionEventPayload
>;

type CollectionCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionCreatedEvent implements CollectionCreatedEventType {
  occurredAt: Date;
  eventName = "collection.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

type CollectionArchivedEventType = DomainEvent<
  "collection.archived",
  CollectionEventPayload
>;

type CollectionArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionArchivedEvent implements CollectionArchivedEventType {
  occurredAt: Date;
  eventName = "collection.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

type CollectionMetadataUpdatedEventType = DomainEvent<
  "collection.metadata_updated",
  CollectionEventPayload
>;

type CollectionMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionMetadataUpdatedEvent implements CollectionMetadataUpdatedEventType {
  occurredAt: Date;
  eventName = "collection.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

type CollectionPublishedEventType = DomainEvent<
  "collection.published",
  CollectionEventPayload
>;

type CollectionPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionPublishedEvent implements CollectionPublishedEventType {
  occurredAt: Date;
  eventName = "collection.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

type CollectionSeoMetadataUpdatedEventType = DomainEvent<
  "collection.seo_metadata_updated",
  CollectionEventPayload
>;

type CollectionSeoMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionSeoMetadataUpdatedEvent implements CollectionSeoMetadataUpdatedEventType {
  occurredAt: Date;
  eventName = "collection.seo_metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

type CollectionUnpublishedEventType = DomainEvent<
  "collection.unpublished",
  CollectionEventPayload
>;

type CollectionUnpublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionUnpublishedEvent implements CollectionUnpublishedEventType {
  occurredAt: Date;
  eventName = "collection.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

type CollectionImagesUpdatedEventType = DomainEvent<
  "collection.images_updated",
  CollectionEventPayload
>;

type CollectionImagesUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionImagesUpdatedEvent implements CollectionImagesUpdatedEventType {
  occurredAt: Date;
  eventName = "collection.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: CollectionEventPayload;

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

