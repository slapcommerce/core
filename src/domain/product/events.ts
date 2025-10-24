import type { DomainEvent } from "../_base/domainEvent";

type ProductCreatedEventPayload = {
  title: string;
  description: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  [key: string]: any;
};

type ProductCreatedEventType = DomainEvent<
  "product.created",
  ProductCreatedEventPayload
>;

type ProductCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductCreatedEventPayload;
};

export class ProductCreatedEvent implements ProductCreatedEventType {
  static payloadFields = [
    "title",
    "description",
    "slug",
    "collectionIds",
    "variantIds",
    "archived",
  ] as const;

  static payloadVersion = 1;

  occurredAt: Date;
  eventName = "product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductCreatedEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    payload,
  }: ProductCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
  }
}
