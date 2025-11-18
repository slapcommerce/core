import type { DomainEvent } from "../_base/domainEvent";
import {
  ProductCreatedEvent,
  ProductArchivedEvent,
  ProductPublishedEvent,
  ProductUnpublishedEvent,
  ProductSlugChangedEvent,
  ProductDetailsUpdatedEvent,
  ProductMetadataUpdatedEvent,
  ProductClassificationUpdatedEvent,
  ProductTagsUpdatedEvent,
  ProductCollectionsUpdatedEvent,
  ProductShippingSettingsUpdatedEvent,
  ProductPageLayoutUpdatedEvent,
  type ProductState,
} from "./events";

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
  userId: string;
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
  slug: string;
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
    userId,
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
    // Draft products can be created without variants or collections
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
    const priorState = {} as ProductState;
    const newState = productAggregate.toState();
    const productCreatedEvent = new ProductCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    productAggregate.uncommittedEvents.push(productCreatedEvent);
    return productAggregate;
  }

  apply(event: DomainEvent<string, Record<string, unknown>>) {
    switch (event.eventName) {
      case "product.created":
        const createdEvent = event as ProductCreatedEvent;
        // Apply new state from created event
        const createdState = createdEvent.payload.newState;
        this.title = createdState.title;
        this.shortDescription = createdState.shortDescription;
        this.slug = createdState.slug;
        this.collectionIds = createdState.collectionIds;
        this.variantIds = createdState.variantIds;
        this.richDescriptionUrl = createdState.richDescriptionUrl;
        this.productType = createdState.productType;
        this.vendor = createdState.vendor;
        this.variantOptions = createdState.variantOptions;
        this.metaTitle = createdState.metaTitle;
        this.metaDescription = createdState.metaDescription;
        this.tags = createdState.tags;
        this.requiresShipping = createdState.requiresShipping;
        this.taxable = createdState.taxable;
        this.pageLayoutId = createdState.pageLayoutId;
        this.status = createdState.status;
        this.createdAt = createdState.createdAt;
        this.updatedAt = createdState.updatedAt;
        this.publishedAt = createdState.publishedAt;
        break;
      case "product.archived":
        const archivedEvent = event as ProductArchivedEvent;
        const archivedState = archivedEvent.payload.newState;
        this.status = archivedState.status;
        this.updatedAt = archivedState.updatedAt;
        break;
      case "product.published":
        const publishedEvent = event as ProductPublishedEvent;
        const publishedState = publishedEvent.payload.newState;
        this.status = publishedState.status;
        this.publishedAt = publishedState.publishedAt;
        this.updatedAt = publishedState.updatedAt;
        break;
      case "product.unpublished":
        const unpublishedEvent = event as ProductUnpublishedEvent;
        const unpublishedState = unpublishedEvent.payload.newState;
        this.status = unpublishedState.status;
        this.publishedAt = unpublishedState.publishedAt;
        this.updatedAt = unpublishedState.updatedAt;
        break;
      case "product.slug_changed":
        const slugChangedEvent = event as ProductSlugChangedEvent;
        const slugChangedState = slugChangedEvent.payload.newState;
        this.slug = slugChangedState.slug;
        this.updatedAt = slugChangedState.updatedAt;
        break;
      case "product.details_updated":
        const detailsUpdatedEvent = event as ProductDetailsUpdatedEvent;
        const detailsUpdatedState = detailsUpdatedEvent.payload.newState;
        this.title = detailsUpdatedState.title;
        this.shortDescription = detailsUpdatedState.shortDescription;
        this.richDescriptionUrl = detailsUpdatedState.richDescriptionUrl;
        this.updatedAt = detailsUpdatedState.updatedAt;
        break;
      case "product.metadata_updated":
        const metadataUpdatedEvent = event as ProductMetadataUpdatedEvent;
        const metadataUpdatedState = metadataUpdatedEvent.payload.newState;
        this.metaTitle = metadataUpdatedState.metaTitle;
        this.metaDescription = metadataUpdatedState.metaDescription;
        this.updatedAt = metadataUpdatedState.updatedAt;
        break;
      case "product.classification_updated":
        const classificationUpdatedEvent =
          event as ProductClassificationUpdatedEvent;
        const classificationUpdatedState =
          classificationUpdatedEvent.payload.newState;
        this.productType = classificationUpdatedState.productType;
        this.vendor = classificationUpdatedState.vendor;
        this.updatedAt = classificationUpdatedState.updatedAt;
        break;
      case "product.tags_updated":
        const tagsUpdatedEvent = event as ProductTagsUpdatedEvent;
        const tagsUpdatedState = tagsUpdatedEvent.payload.newState;
        this.tags = tagsUpdatedState.tags;
        this.updatedAt = tagsUpdatedState.updatedAt;
        break;
      case "product.collections_updated":
        const collectionsUpdatedEvent = event as ProductCollectionsUpdatedEvent;
        const collectionsUpdatedState = collectionsUpdatedEvent.payload.newState;
        this.collectionIds = collectionsUpdatedState.collectionIds;
        this.updatedAt = collectionsUpdatedState.updatedAt;
        break;
      case "product.shipping_settings_updated":
        const shippingSettingsUpdatedEvent =
          event as ProductShippingSettingsUpdatedEvent;
        const shippingSettingsUpdatedState =
          shippingSettingsUpdatedEvent.payload.newState;
        this.requiresShipping = shippingSettingsUpdatedState.requiresShipping;
        this.taxable = shippingSettingsUpdatedState.taxable;
        this.updatedAt = shippingSettingsUpdatedState.updatedAt;
        break;
      case "product.page_layout_updated":
        const pageLayoutUpdatedEvent = event as ProductPageLayoutUpdatedEvent;
        const pageLayoutUpdatedState = pageLayoutUpdatedEvent.payload.newState;
        this.pageLayoutId = pageLayoutUpdatedState.pageLayoutId;
        this.updatedAt = pageLayoutUpdatedState.updatedAt;
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventName}`);
    }
    this.version++;
    this.events.push(event);
  }

  private toState(): ProductState {
    return {
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
    };
  }

  archive(userId: string) {
    if (this.status === "archived") {
      throw new Error("Product is already archived");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const archivedEvent = new ProductArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(archivedEvent);
    return this;
  }

  publish(userId: string) {
    if (this.variantIds.length === 0) {
      throw new Error("Cannot publish product without at least one variant");
    }
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived product");
    }
    if (this.status === "active") {
      throw new Error("Product is already published");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const publishedEvent = new ProductPublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(publishedEvent);
    return this;
  }

  unpublish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot unpublish an archived product");
    }
    if (this.status === "draft") {
      throw new Error("Product is already unpublished");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "draft";
    this.publishedAt = null;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const unpublishedEvent = new ProductUnpublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(unpublishedEvent);
    return this;
  }

  changeSlug(newSlug: string, userId: string) {
    if (this.slug === newSlug) {
      throw new Error("New slug must be different from current slug");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.slug = newSlug;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const slugChangedEvent = new ProductSlugChangedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(slugChangedEvent);
    return this;
  }

  updateDetails(
    title: string,
    shortDescription: string,
    richDescriptionUrl: string,
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.title = title;
    this.shortDescription = shortDescription;
    this.richDescriptionUrl = richDescriptionUrl;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const detailsUpdatedEvent = new ProductDetailsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(detailsUpdatedEvent);
    return this;
  }

  updateMetadata(metaTitle: string, metaDescription: string, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const metadataUpdatedEvent = new ProductMetadataUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(metadataUpdatedEvent);
    return this;
  }

  updateClassification(productType: string, vendor: string, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.productType = productType;
    this.vendor = vendor;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const classificationUpdatedEvent = new ProductClassificationUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(classificationUpdatedEvent);
    return this;
  }

  updateTags(tags: string[], userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.tags = tags;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const tagsUpdatedEvent = new ProductTagsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(tagsUpdatedEvent);
    return this;
  }

  updateCollections(collectionIds: string[], userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.collectionIds = collectionIds;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const collectionsUpdatedEvent = new ProductCollectionsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(collectionsUpdatedEvent);
    return this;
  }

  updateShippingSettings(
    requiresShipping: boolean,
    taxable: boolean,
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.requiresShipping = requiresShipping;
    this.taxable = taxable;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const shippingSettingsUpdatedEvent =
      new ProductShippingSettingsUpdatedEvent({
        occurredAt,
        correlationId: this.correlationId,
        aggregateId: this.id,
        version: this.version,
        userId,
        priorState,
        newState,
      });
    this.uncommittedEvents.push(shippingSettingsUpdatedEvent);
    return this;
  }

  updatePageLayout(pageLayoutId: string | null, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.pageLayoutId = pageLayoutId;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const pageLayoutUpdatedEvent = new ProductPageLayoutUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(pageLayoutUpdatedEvent);
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
