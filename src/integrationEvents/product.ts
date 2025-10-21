import type { IntegrationEvent } from "./_base";

// Product Created Integration Event
type ProductCreatedPayload = {
  productId: string;
  title: string;
  description: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
};

type ProductCreatedIntegrationEventType = IntegrationEvent<
  "product.created",
  ProductCreatedPayload
>;

type ProductCreatedIntegrationEventParams = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductCreatedPayload;
};

export class ProductCreatedIntegrationEvent
  implements ProductCreatedIntegrationEventType
{
  eventId: string;
  eventName = "product.created" as const;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductCreatedPayload;

  constructor({
    eventId,
    aggregateId,
    version,
    occurredAt,
    correlationId,
    payload,
  }: ProductCreatedIntegrationEventParams) {
    this.eventId = eventId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.payload = payload;
  }
}

// Product Archived Integration Event
type ProductArchivedPayload = {
  productId: string;
};

type ProductArchivedIntegrationEventType = IntegrationEvent<
  "product.archived",
  ProductArchivedPayload
>;

type ProductArchivedIntegrationEventParams = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductArchivedPayload;
};

export class ProductArchivedIntegrationEvent
  implements ProductArchivedIntegrationEventType
{
  eventId: string;
  eventName = "product.archived" as const;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductArchivedPayload;

  constructor({
    eventId,
    aggregateId,
    version,
    occurredAt,
    correlationId,
    payload,
  }: ProductArchivedIntegrationEventParams) {
    this.eventId = eventId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.payload = payload;
  }
}
