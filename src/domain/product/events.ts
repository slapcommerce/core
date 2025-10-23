import type { DomainEvent } from "../_base/domainEvent";
import { encode, decode } from "@msgpack/msgpack";

type ProductCreatedEventPayload = {
  title: string;
  description: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  archived: boolean;
  [key: string]: any;
};

type ProductCreatedEventType = DomainEvent<
  "ProductCreated",
  ProductCreatedEventPayload
>;

type ProductCreatedEventParams = {
  createdAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductCreatedEventPayload;
  committed: boolean;
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

  createdAt: Date;
  eventName = "ProductCreated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductCreatedEventPayload;
  committed: boolean;

  constructor({
    createdAt,
    aggregateId,
    correlationId,
    version,
    payload,
    committed,
  }: ProductCreatedEventParams) {
    this.createdAt = createdAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
    this.committed = committed;
  }
}

type ProductVariantLinkedEventPayload = {
  variantId: string;
};

type ProductVariantLinkedEventType = DomainEvent<
  "ProductVariantLinked",
  ProductVariantLinkedEventPayload
>;

type ProductVariantLinkedEventParams = {
  createdAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductVariantLinkedEventPayload;
  committed: boolean;
};

export class ProductVariantLinkedEvent
  implements ProductVariantLinkedEventType
{
  static payloadFields = ["variantId"] as const;
  static payloadVersion = 1;

  createdAt: Date;
  eventName = "ProductVariantLinked" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductVariantLinkedEventPayload;
  committed: boolean;

  constructor({
    createdAt,
    aggregateId,
    correlationId,
    version,
    payload,
    committed,
  }: ProductVariantLinkedEventParams) {
    this.createdAt = createdAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
    this.committed = committed;
  }
}

type ProductArchivedEventPayload = Record<string, never>;

type ProductArchivedEventType = DomainEvent<
  "ProductArchived",
  ProductArchivedEventPayload
>;

type ProductArchivedEventParams = {
  createdAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  payload: ProductArchivedEventPayload;
  committed: boolean;
};

export class ProductArchivedEvent implements ProductArchivedEventType {
  static payloadFields = [] as const;
  static payloadVersion = 1;

  createdAt: Date;
  eventName = "ProductArchived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: ProductArchivedEventPayload;
  committed: boolean;

  constructor({
    createdAt,
    aggregateId,
    correlationId,
    version,
    payload,
    committed,
  }: ProductArchivedEventParams) {
    this.createdAt = createdAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.payload = payload;
    this.committed = committed;
  }
}
