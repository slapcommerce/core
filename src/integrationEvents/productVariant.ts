import type { IntegrationEvent } from "./_base";

// Product Variant Created Integration Event
type ProductVariantCreatedPayload = {
  variantId: string;
  productId: string;
  sku: string;
  priceUsd: string; // Use string for money to avoid floating point issues
  imageUrl: string;
  attributes: {
    size: string;
    color: string;
  };
};

type ProductVariantCreatedIntegrationEventType = IntegrationEvent<
  "product_variant.created",
  ProductVariantCreatedPayload
>;

type ProductVariantCreatedIntegrationEventParams = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductVariantCreatedPayload;
};

export class ProductVariantCreatedIntegrationEvent
  implements ProductVariantCreatedIntegrationEventType
{
  eventId: string;
  eventName = "product_variant.created" as const;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductVariantCreatedPayload;

  constructor({
    eventId,
    aggregateId,
    version,
    occurredAt,
    correlationId,
    payload,
  }: ProductVariantCreatedIntegrationEventParams) {
    this.eventId = eventId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.payload = payload;
  }
}

// Product Variant Archived Integration Event
type ProductVariantArchivedPayload = {
  variantId: string;
};

type ProductVariantArchivedIntegrationEventType = IntegrationEvent<
  "product_variant.archived",
  ProductVariantArchivedPayload
>;

type ProductVariantArchivedIntegrationEventParams = {
  eventId: string;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductVariantArchivedPayload;
};

export class ProductVariantArchivedIntegrationEvent
  implements ProductVariantArchivedIntegrationEventType
{
  eventId: string;
  eventName = "product_variant.archived" as const;
  aggregateId: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  payload: ProductVariantArchivedPayload;

  constructor({
    eventId,
    aggregateId,
    version,
    occurredAt,
    correlationId,
    payload,
  }: ProductVariantArchivedIntegrationEventParams) {
    this.eventId = eventId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.payload = payload;
  }
}
