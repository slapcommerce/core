import type { IntegrationEvent } from "./_base";

// Collection Created Integration Event
type CollectionCreatedPayload = {
  collectionId: string;
  name: string;
  description: string;
  slug: string;
  productIds: string[];
};

type CollectionCreatedIntegrationEventType = IntegrationEvent<
  "collection.created",
  CollectionCreatedPayload
>;

type CollectionCreatedIntegrationEventParams = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: CollectionCreatedPayload;
};

export class CollectionCreatedIntegrationEvent
  implements CollectionCreatedIntegrationEventType
{
  eventId: string;
  eventName = "collection.created" as const;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: CollectionCreatedPayload;

  constructor({
    eventId,
    aggregateId,
    version,
    occurredAt,
    correlationId,
    payload,
  }: CollectionCreatedIntegrationEventParams) {
    this.eventId = eventId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.payload = payload;
  }
}

// Collection Archived Integration Event
type CollectionArchivedPayload = {
  collectionId: string;
};

type CollectionArchivedIntegrationEventType = IntegrationEvent<
  "collection.archived",
  CollectionArchivedPayload
>;

type CollectionArchivedIntegrationEventParams = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: CollectionArchivedPayload;
};

export class CollectionArchivedIntegrationEvent
  implements CollectionArchivedIntegrationEventType
{
  eventId: string;
  eventName = "collection.archived" as const;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: CollectionArchivedPayload;

  constructor({
    eventId,
    aggregateId,
    version,
    occurredAt,
    correlationId,
    payload,
  }: CollectionArchivedIntegrationEventParams) {
    this.eventId = eventId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.payload = payload;
  }
}
