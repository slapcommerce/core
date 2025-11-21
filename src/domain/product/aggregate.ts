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
  ProductTaxSettingsUpdatedEvent,
  ProductPageLayoutUpdatedEvent,
  ProductFulfillmentTypeUpdatedEvent,
  ProductVariantOptionsUpdatedEvent,
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
  events: DomainEvent[];
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
  productType: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  taxable: boolean;
  taxId: string;
  fulfillmentType: "digital" | "dropship";
  dropshipSafetyBuffer?: number;
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
  fulfillmentType?: "digital" | "dropship";
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  taxable: boolean;
  taxId: string;
  dropshipSafetyBuffer?: number;
};

export class ProductAggregate {
  public id: string;
  public version: number = 0;
  public events: DomainEvent[];
  public uncommittedEvents: DomainEvent[] = [];
  private correlationId: string;
  private createdAt: Date;
  private title: string;
  private shortDescription: string;
  slug: string;
  private collectionIds: string[];
  public variantIds: string[];
  private richDescriptionUrl: string;
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;
  private updatedAt: Date;
  private productType: string;
  public fulfillmentType: "digital" | "dropship";
  private vendor: string;
  private variantOptions: { name: string; values: string[] }[];
  private metaTitle: string;
  private metaDescription: string;
  private tags: string[];
  private taxable: boolean;
  private taxId: string;
  private dropshipSafetyBuffer?: number;

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
    fulfillmentType,
    vendor,
    variantOptions,
    metaTitle,
    metaDescription,
    tags,
    taxable,
    taxId,
    dropshipSafetyBuffer,
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
    this.fulfillmentType = fulfillmentType;
    this.vendor = vendor;
    this.variantOptions = variantOptions;
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.tags = tags;
    this.taxable = taxable;
    this.taxId = taxId;
    this.dropshipSafetyBuffer = dropshipSafetyBuffer;
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
    fulfillmentType = "digital",
    vendor,
    variantOptions,
    metaTitle,
    metaDescription,
    tags,
    taxId,
    taxable,
    dropshipSafetyBuffer,
  }: CreateProductAggregateParams) {
    if (collectionIds.length === 0) {
      throw new Error("Product must belong to at least one collection");
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
      fulfillmentType,
      vendor,
      variantOptions,
      metaTitle,
      metaDescription,
      tags,
      taxable,
      taxId,
      dropshipSafetyBuffer,
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

  private toState(): ProductState {
    return {
      title: this.title,
      shortDescription: this.shortDescription,
      slug: this.slug,
      collectionIds: this.collectionIds,
      variantIds: this.variantIds,
      richDescriptionUrl: this.richDescriptionUrl,
      productType: this.productType,
      fulfillmentType: this.fulfillmentType,
      vendor: this.vendor,
      variantOptions: this.variantOptions,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      tags: this.tags,
      taxable: this.taxable,
      taxId: this.taxId,
      dropshipSafetyBuffer: this.dropshipSafetyBuffer,
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

    // Validate fulfillment type requirements
    if (this.fulfillmentType === "dropship") {
      if (
        this.dropshipSafetyBuffer === undefined ||
        this.dropshipSafetyBuffer === null ||
        this.dropshipSafetyBuffer < 0
      ) {
        throw new Error(
          "Dropship products must have a non-negative safety buffer",
        );
      }
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

  updateTaxSettings(
    taxable: boolean,
    taxId: string,
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.taxable = taxable;
    this.taxId = taxId;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const taxSettingsUpdatedEvent =
      new ProductTaxSettingsUpdatedEvent({
        occurredAt,
        correlationId: this.correlationId,
        aggregateId: this.id,
        version: this.version,
        userId,
        priorState,
        newState,
      });
    this.uncommittedEvents.push(taxSettingsUpdatedEvent);
    return this;
  }

  updatePageLayout(userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
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

  updateFulfillmentType(
    fulfillmentType: "digital" | "dropship",
    options: {
      dropshipSafetyBuffer?: number;
    },
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.fulfillmentType = fulfillmentType;
    if (fulfillmentType === "digital") {
      // Clear dropship fields
      this.dropshipSafetyBuffer = undefined;
    } else if (fulfillmentType === "dropship") {
      if (options.dropshipSafetyBuffer !== undefined) {
        this.dropshipSafetyBuffer = options.dropshipSafetyBuffer;
      }
    }

    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const fulfillmentTypeUpdatedEvent = new ProductFulfillmentTypeUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(fulfillmentTypeUpdatedEvent);
    return this;
  }

  updateOptions(
    variantOptions: { name: string; values: string[] }[],
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.variantOptions = variantOptions;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const variantOptionsUpdatedEvent = new ProductVariantOptionsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(variantOptionsUpdatedEvent);
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
      fulfillmentType: payload.fulfillmentType,
      vendor: payload.vendor,
      variantOptions: payload.variantOptions,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      tags: payload.tags,
      taxable: payload.taxable,
      taxId: payload.taxId,
      dropshipSafetyBuffer: payload.dropshipSafetyBuffer,
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
      fulfillmentType: this.fulfillmentType,
      vendor: this.vendor,
      variantOptions: this.variantOptions,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      tags: this.tags,
      taxable: this.taxable,
      dropshipSafetyBuffer: this.dropshipSafetyBuffer,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}