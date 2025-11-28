import { CollectionCreatedEvent, CollectionArchivedEvent, CollectionMetadataUpdatedEvent, CollectionPublishedEvent, CollectionSeoMetadataUpdatedEvent, CollectionUnpublishedEvent, CollectionImagesUpdatedEvent, type CollectionState, type CollectionEvent } from "./events";
import { ImageCollection } from "../_base/imageCollection";

type CollectionAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  slug: string;
  version: number;
  events: CollectionEvent[];
  status: "draft" | "active" | "archived";
  metaTitle: string;
  metaDescription: string;
  publishedAt: Date | null;
  images: ImageCollection;
  productPositionsAggregateId: string;
};

type CreateCollectionAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  name: string;
  description: string | null;
  slug: string;
  productPositionsAggregateId: string;
};

export class CollectionAggregate {
  public id: string;
  public version: number = 0;
  public events: CollectionEvent[];
  public uncommittedEvents: CollectionEvent[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
  private name: string;
  private description: string | null;
  slug: string;
  private status: "draft" | "active" | "archived";
  private metaTitle: string;
  private metaDescription: string;
  private publishedAt: Date | null;
  public images: ImageCollection;
  public productPositionsAggregateId: string;

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    name,
    description,
    slug,
    version = 0,
    events,
    status,
    metaTitle,
    metaDescription,
    publishedAt,
    images,
    productPositionsAggregateId,
  }: CollectionAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.name = name;
    this.description = description;
    this.slug = slug;
    this.version = version;
    this.events = events;
    this.status = status;
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.publishedAt = publishedAt;
    this.images = images;
    this.productPositionsAggregateId = productPositionsAggregateId;
  }

  static create({
    id,
    correlationId,
    userId,
    name,
    description,
    slug,
    productPositionsAggregateId,
  }: CreateCollectionAggregateParams) {
    const createdAt = new Date();
    const collectionAggregate = new CollectionAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      name,
      description,
      slug,
      version: 0,
      events: [],
      status: "draft",
      metaTitle: "",
      metaDescription: "",
      publishedAt: null,
      images: ImageCollection.empty(),
      productPositionsAggregateId,
    });
    const priorState = {} as CollectionState;
    const newState = collectionAggregate.toState();
    const collectionCreatedEvent = new CollectionCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    collectionAggregate.uncommittedEvents.push(collectionCreatedEvent);
    return collectionAggregate;
  }

  private toState(): CollectionState {
    return {
      id: this.id,
      correlationId: this.correlationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      name: this.name,
      description: this.description,
      slug: this.slug,
      version: this.version,
      status: this.status,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      publishedAt: this.publishedAt,
      images: this.images,
      productPositionsAggregateId: this.productPositionsAggregateId,
    };
  }

  publish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived collection");
    }
    if (this.status === "active") {
      throw new Error("Collection is already published");
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
    const publishedEvent = new CollectionPublishedEvent({
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

  archive(userId: string) {
    if (this.status === "archived") {
      throw new Error("Collection is already archived");
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
    const archivedEvent = new CollectionArchivedEvent({
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

  updateMetadata(name: string, description: string | null, slug: string, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.name = name;
    this.description = description;
    this.slug = slug;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const metadataUpdatedEvent = new CollectionMetadataUpdatedEvent({
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

  unpublish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot unpublish an archived collection");
    }
    if (this.status === "draft") {
      throw new Error("Collection is already unpublished");
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
    const unpublishedEvent = new CollectionUnpublishedEvent({
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

  updateSeoMetadata(metaTitle: string, metaDescription: string, userId: string) {
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
    const seoMetadataUpdatedEvent = new CollectionSeoMetadataUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(seoMetadataUpdatedEvent);
    return this;
  }

  updateImages(images: ImageCollection, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.images = images;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const imagesUpdatedEvent = new CollectionImagesUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(imagesUpdatedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);

    // Handle migration from old imageUrls (single image) to images (array)
    let images: ImageCollection;
    if (payload.images) {
      // New format: already an array
      images = ImageCollection.fromJSON(payload.images);
    } else if (payload.imageUrls) {
      // Old format: single image, wrap in array
      images = ImageCollection.fromJSON([{
        imageId: `legacy-${snapshot.aggregateId}`,
        urls: payload.imageUrls,
        uploadedAt: payload.updatedAt || new Date().toISOString(),
        altText: "",
      }]);
    } else {
      // No images
      images = ImageCollection.empty();
    }

    return new CollectionAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      version: snapshot.version,
      events: [],
      status: payload.status,
      metaTitle: payload.metaTitle ?? "",
      metaDescription: payload.metaDescription ?? "",
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      images,
      productPositionsAggregateId: payload.productPositionsAggregateId ?? "",
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      publishedAt: this.publishedAt,
      images: this.images.toJSON(),
      version: this.version,
      productPositionsAggregateId: this.productPositionsAggregateId,
    };
  }
}

