import {ProductCreatedEvent,
  ProductArchivedEvent,
  ProductPublishedEvent,
  ProductUnpublishedEvent,
  ProductSlugChangedEvent,
  ProductDetailsUpdatedEvent,
  ProductMetadataUpdatedEvent,
  ProductClassificationUpdatedEvent,
  ProductTagsUpdatedEvent,
  ProductCollectionsUpdatedEvent,
  ProductFulfillmentTypeUpdatedEvent,
  variantsOptionsUpdatedEvent,
  type ProductState,
  type ProductEvent,
  type ProductCollection,
  ProductUpdateProductTaxDetailsEvent,
  ProductCollectionPositionsUpdatedEvent} from "./events";

type ProductAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string;
  slug: string;
  collections: ProductCollection[];
  variantIds: string[];
  version: number;
  richDescriptionUrl: string;
  events: ProductEvent[];
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
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
  name: string;
  description: string;
  slug: string;
  collections: ProductCollection[];
  variantIds: string[];
  richDescriptionUrl: string;
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
  public events: ProductEvent[];
  public uncommittedEvents: ProductEvent[] = [];
  private correlationId: string;
  private createdAt: Date;
  private name: string;
  private description: string;
  slug: string;
  private collections: ProductCollection[];
  public variantIds: string[];
  private richDescriptionUrl: string;
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;
  private updatedAt: Date;
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
    name,
    description,
    slug,
    collections,
    variantIds,
    richDescriptionUrl,
    version = 0,
    events,
    status,
    publishedAt,
    updatedAt,
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
    this.name = name;
    this.description = description;
    this.slug = slug;
    this.collections = collections;
    this.variantIds = variantIds;
    this.richDescriptionUrl = richDescriptionUrl;
    this.version = version;
    this.events = events;
    this.status = status;
    this.publishedAt = publishedAt;
    this.updatedAt = updatedAt;
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
    name,
    description,
    slug,
    collections,
    variantIds,
    richDescriptionUrl,
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
    if (collections.length === 0) {
      throw new Error("Product must belong to at least one collection");
    }

    const createdAt = new Date();
    const productAggregate = new ProductAggregate({
      id,
      correlationId,
      createdAt,
      name,
      description,
      slug,
      collections,
      variantIds,
      richDescriptionUrl,
      version: 0,
      events: [],
      status: "draft",
      publishedAt: null,
      updatedAt: createdAt,
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
      name: this.name,
      description: this.description,
      slug: this.slug,
      collections: this.collections,
      variantIds: this.variantIds,
      richDescriptionUrl: this.richDescriptionUrl,
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
    name: string,
    description: string,
    richDescriptionUrl: string,
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.name = name;
    this.description = description;
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

  updateVendor(vendor: string, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
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

  updateCollections(collections: ProductCollection[], userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.collections = collections;
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

  updateCollectionPositions(
    collectionId: string,
    position: number,
    userId: string,
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Find and update the collection's position
    const collectionIndex = this.collections.findIndex(
      (c) => c.collectionId === collectionId,
    );
    if (collectionIndex === -1) {
      throw new Error("Product is not in this collection");
    }
    const existingCollection = this.collections[collectionIndex]!;
    this.collections[collectionIndex] = {
      collectionId: existingCollection.collectionId,
      position,
    };
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const positionsUpdatedEvent = new ProductCollectionPositionsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(positionsUpdatedEvent);
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
    const variantOptionsUpdatedEvent = new variantsOptionsUpdatedEvent({
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
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new ProductAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      collections: payload.collections,
      variantIds: payload.variantIds,
      richDescriptionUrl: payload.richDescriptionUrl,
      version: snapshot.version,
      events: [],
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      updatedAt: new Date(payload.updatedAt),
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
      name: this.name,
      description: this.description,
      slug: this.slug,
      collections: this.collections,
      variantIds: this.variantIds,
      richDescriptionUrl: this.richDescriptionUrl,
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
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }

  updateProductTaxDetails(
    taxable: boolean,
    taxId: string,
    userId: string
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
    const event = new ProductUpdateProductTaxDetailsEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }
}
