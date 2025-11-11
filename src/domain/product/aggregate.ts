import type { DomainEvent } from "../_base/domainEvent";
import { ProductCreatedEvent, ProductArchivedEvent } from "./events";

type ProductAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  shortDescription: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  version: number;
  richDescriptionUrl: string;
  events: DomainEvent<string, Record<string, unknown>>[];
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
  productType: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  requiresShipping: boolean;
  taxable: boolean;
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
  productType: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  requiresShipping: boolean;
  taxable: boolean;
  pageLayoutId: string | null;
};

export class ProductAggregate {
  public id: string;
  public version: number = 0;
  public events: DomainEvent<string, Record<string, unknown>>[];
  public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
  private correlationId: string;
  private createdAt: Date;
  private title: string;
  private shortDescription: string;
  private slug: string;
  private collectionIds: string[];
  private variantIds: string[];
  private richDescriptionUrl: string;
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;
  private updatedAt: Date;
  private productType: string;
  private vendor: string;
  private variantOptions: { name: string; values: string[] }[];
  private metaTitle: string;
  private metaDescription: string;
  private tags: string[];
  private requiresShipping: boolean;
  private taxable: boolean;
  private pageLayoutId: string | null;

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
        status: "draft",
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
        publishedAt: null,
      },
    });
    productAggregate.uncommittedEvents.push(productCreatedEvent);
    return productAggregate;
  }

  apply(event: DomainEvent<string, Record<string, unknown>>) {
    switch (event.eventName) {
      case "product.archived":
        this.status = "archived";
        this.updatedAt = event.occurredAt;
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventName}`);
    }
    this.version++;
    this.events.push(event);
  }

  archive() {
    if (this.status === "archived") {
      throw new Error("Product is already archived");
    }
    const occurredAt = new Date();
    // Mutate state first
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    // Then emit the event with full state
    const snapshot = this.toSnapshot();
    const archivedEvent = new ProductArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      payload: {
        title: snapshot.title,
        shortDescription: snapshot.shortDescription,
        slug: snapshot.slug,
        collectionIds: snapshot.collectionIds,
        variantIds: snapshot.variantIds,
        richDescriptionUrl: snapshot.richDescriptionUrl,
        productType: snapshot.productType,
        vendor: snapshot.vendor,
        variantOptions: snapshot.variantOptions,
        metaTitle: snapshot.metaTitle,
        metaDescription: snapshot.metaDescription,
        tags: snapshot.tags,
        requiresShipping: snapshot.requiresShipping,
        taxable: snapshot.taxable,
        pageLayoutId: snapshot.pageLayoutId,
        status: "archived",
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        publishedAt: snapshot.publishedAt ? snapshot.publishedAt.toISOString() : null,
      },
    });
    this.uncommittedEvents.push(archivedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregate_id: string;
    correlation_id: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new ProductAggregate({
      id: snapshot.aggregate_id,
      correlationId: snapshot.correlation_id,
      createdAt: new Date(payload.createdAt),
      title: payload.title,
      shortDescription: payload.shortDescription,
      slug: payload.slug,
      collectionIds: payload.collectionIds,
      variantIds: payload.variantIds,
      richDescriptionUrl: payload.richDescriptionUrl,
      version: snapshot.version,
      events: [],
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      updatedAt: new Date(payload.updatedAt),
      productType: payload.productType,
      vendor: payload.vendor,
      variantOptions: payload.variantOptions,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      tags: payload.tags,
      requiresShipping: payload.requiresShipping,
      taxable: payload.taxable,
      pageLayoutId: payload.pageLayoutId,
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      title: this.title,
      shortDescription: this.shortDescription,
      slug: this.slug,
      collectionIds: this.collectionIds,
      variantIds: this.variantIds,
      richDescriptionUrl: this.richDescriptionUrl,
      productType: this.productType,
      vendor: this.vendor,
      variantOptions: this.variantOptions,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      tags: this.tags,
      requiresShipping: this.requiresShipping,
      taxable: this.taxable,
      pageLayoutId: this.pageLayoutId,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      version: this.version,
    };
  }
}
