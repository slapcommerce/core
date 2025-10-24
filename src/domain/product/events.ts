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
    "shortDescription",
    "slug",
    "collectionIds",
    "variantIds",
    "richDescriptionUrl",
    "productType",
    "vendor",
    "variantOptions",
    "metaTitle",
    "metaDescription",
    "tags",
    "requiresShipping",
    "taxable",
    "pageLayoutId",
  ] as const;

  static payloadVersion = 2;

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
