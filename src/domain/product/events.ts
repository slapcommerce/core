import type { DomainEvent } from "../_base/domainEvent";

type ProductCreatedEventPayload = {
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

type ProductArchivedEventPayload = {
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
  status: "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  [key: string]: any;
};

type ProductArchivedEventType = DomainEvent<
  "product.archived",
  ProductArchivedEventPayload
>;

type ProductArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductArchivedEventPayload;
};

export class ProductArchivedEvent implements ProductArchivedEventType {
  occurredAt: Date;
  eventName = "product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductArchivedEventPayload;

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

type ProductPublishedEventPayload = {
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
  status: "active";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
  [key: string]: any;
};

type ProductPublishedEventType = DomainEvent<
  "product.published",
  ProductPublishedEventPayload
>;

type ProductPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductPublishedEventPayload;
};

export class ProductPublishedEvent implements ProductPublishedEventType {
  occurredAt: Date;
  eventName = "product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductPublishedEventPayload;

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
