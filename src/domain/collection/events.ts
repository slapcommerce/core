import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type CollectionState = {
  name: string;
  description: string | null;
  slug: string;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
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
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionCreatedEvent implements CollectionCreatedEventType {
  occurredAt: Date;
  eventName = "collection.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: CollectionEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: CollectionCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
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
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionArchivedEvent implements CollectionArchivedEventType {
  occurredAt: Date;
  eventName = "collection.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: CollectionEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: CollectionArchivedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
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
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionMetadataUpdatedEvent implements CollectionMetadataUpdatedEventType {
  occurredAt: Date;
  eventName = "collection.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: CollectionEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: CollectionMetadataUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
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
  priorState: CollectionState;
  newState: CollectionState;
};

export class CollectionPublishedEvent implements CollectionPublishedEventType {
  occurredAt: Date;
  eventName = "collection.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: CollectionEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    priorState,
    newState,
  }: CollectionPublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = { priorState, newState };
  }
}

