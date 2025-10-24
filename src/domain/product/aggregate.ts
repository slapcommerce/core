import type { DomainEvent } from "../_base/domainEvent";
import { ProductCreatedEvent } from "./events";

type ProductAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  title: string;
  shortDescription: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  version: number;
  richDescriptionUrl: string;
  events: DomainEvent<string, Record<string, unknown>>[];
  // Tier 1
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
  updatedAt: Date;
  productType: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  // Tier 2
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  requiresShipping: boolean;
  taxable: boolean;
  // Tier 3
  pageLayoutId: string | null;
};

type CreateProductAggregateParams = {
  id: string;
  correlationId: string;
  title: string;
  shortDescription: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  richDescriptionUrl: string;
  // Tier 1
  productType: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  // Tier 2
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  requiresShipping: boolean;
  taxable: boolean;
  // Tier 3
  pageLayoutId: string | null;
};

export class ProductAggregate {
  private id: string;
  private correlationId: string;
  private createdAt: Date;
  private title: string;
  private shortDescription: string;
  private slug: string;
  private collectionIds: string[];
  private variantIds: string[];
  private richDescriptionUrl: string;
  // Tier 1
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;
  private updatedAt: Date;
  private productType: string;
  private vendor: string;
  private variantOptions: { name: string; values: string[] }[];
  // Tier 2
  private metaTitle: string;
  private metaDescription: string;
  private tags: string[];
  private requiresShipping: boolean;
  private taxable: boolean;
  // Tier 3
  private pageLayoutId: string | null;
  public version: number = 0;
  public events: DomainEvent<string, Record<string, unknown>>[];
  public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];

  constructor({
    id,
    correlationId,
    createdAt,
    title,
    shortDescription,
    slug,
    collectionIds,
    variantIds,
    richDescriptionUrl,
    version = 0,
    events,
    status,
    publishedAt,
    updatedAt,
    productType,
    vendor,
    variantOptions,
    metaTitle,
    metaDescription,
    tags,
    requiresShipping,
    taxable,
    pageLayoutId,
  }: ProductAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.title = title;
    this.shortDescription = shortDescription;
    this.slug = slug;
    this.collectionIds = collectionIds;
    this.variantIds = variantIds;
    this.richDescriptionUrl = richDescriptionUrl;
    this.version = version;
    this.events = events;
    this.status = status;
    this.publishedAt = publishedAt;
    this.updatedAt = updatedAt;
    this.productType = productType;
    this.vendor = vendor;
    this.variantOptions = variantOptions;
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.tags = tags;
    this.requiresShipping = requiresShipping;
    this.taxable = taxable;
    this.pageLayoutId = pageLayoutId;
  }

  static create({
    id,
    correlationId,
    title,
    shortDescription,
    slug,
    collectionIds,
    variantIds,
    richDescriptionUrl,
    productType,
    vendor,
    variantOptions,
    metaTitle,
    metaDescription,
    tags,
    requiresShipping,
    taxable,
    pageLayoutId,
  }: CreateProductAggregateParams) {
    if (variantIds.length === 0) {
      throw new Error("Product must have at least one variant");
    }
    if (collectionIds.length === 0) {
      throw new Error("Product must have at least one collection");
    }
    const createdAt = new Date();
    const productAggregate = new ProductAggregate({
      id,
      correlationId,
      createdAt,
      title,
      shortDescription,
      slug,
      collectionIds,
      variantIds,
      richDescriptionUrl,
      version: 0,
      events: [],
      status: "draft",
      publishedAt: null,
      updatedAt: createdAt,
      productType,
      vendor,
      variantOptions,
      metaTitle,
      metaDescription,
      tags,
      requiresShipping,
      taxable,
      pageLayoutId,
    });
    const productCreatedEvent = new ProductCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      payload: {
        title,
        shortDescription,
        slug,
        collectionIds,
        variantIds,
        richDescriptionUrl,
        productType,
        vendor,
        variantOptions,
        metaTitle,
        metaDescription,
        tags,
        requiresShipping,
        taxable,
        pageLayoutId,
      },
    });
    productAggregate.uncommittedEvents.push(productCreatedEvent);
    return productAggregate;
  }

  apply(event: DomainEvent<string, Record<string, unknown>>) {
    switch (event.eventName) {
      default:
        throw new Error(`Unknown event type: ${event.eventName}`);
    }
    this.version++;
    this.events.push(event);
  }

  static loadFromHistory(
    events: DomainEvent<string, Record<string, unknown>>[]
  ) {
    if (events.length === 0) {
      throw new Error("Cannot load aggregate from empty event history");
    }

    const firstEvent = events[0]! as ProductCreatedEvent;
    if (firstEvent.eventName !== "product.created") {
      throw new Error("First event must be ProductCreated");
    }

    const productAggregate = new ProductAggregate({
      id: firstEvent.aggregateId,
      correlationId: firstEvent.correlationId,
      createdAt: firstEvent.occurredAt,
      title: firstEvent.payload.title,
      shortDescription: firstEvent.payload.shortDescription,
      slug: firstEvent.payload.slug,
      collectionIds: firstEvent.payload.collectionIds,
      variantIds: [],
      richDescriptionUrl: firstEvent.payload.richDescriptionUrl,
      version: 0,
      events: [firstEvent],
      status: "draft",
      publishedAt: null,
      updatedAt: firstEvent.occurredAt,
      productType: firstEvent.payload.productType,
      vendor: firstEvent.payload.vendor,
      variantOptions: firstEvent.payload.variantOptions,
      metaTitle: firstEvent.payload.metaTitle,
      metaDescription: firstEvent.payload.metaDescription,
      tags: firstEvent.payload.tags,
      requiresShipping: firstEvent.payload.requiresShipping,
      taxable: firstEvent.payload.taxable,
      pageLayoutId: firstEvent.payload.pageLayoutId,
    });

    for (let i = 1; i < events.length; i++) {
      productAggregate.apply(events[i]!);
    }

    return productAggregate;
  }
}
