import type { DomainEvent } from "../_base/domainEvent";

export type ProductEventPayload = {
  title: string;
  shortDescription: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  richDescriptionUrl: string;
  productType: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  requiresShipping: boolean;
  taxable: boolean;
  pageLayoutId: string | null;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  [key: string]: any;
};

type ProductCreatedEventType = DomainEvent<
  "product.created",
  ProductEventPayload
>;

type ProductCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductEventPayload;
};

export class ProductCreatedEvent implements ProductCreatedEventType {
  occurredAt: Date;
  eventName = "product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductEventPayload;

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

type ProductArchivedEventType = DomainEvent<
  "product.archived",
  ProductEventPayload
>;

type ProductArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductEventPayload;
};

export class ProductArchivedEvent implements ProductArchivedEventType {
  occurredAt: Date;
  eventName = "product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    payload,
  }: ProductArchivedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
  }
}

type ProductPublishedEventType = DomainEvent<
  "product.published",
  ProductEventPayload
>;

type ProductPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductEventPayload;
};

export class ProductPublishedEvent implements ProductPublishedEventType {
  occurredAt: Date;
  eventName = "product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    payload,
  }: ProductPublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
  }
}
