import {
  BundleCreatedEvent,
  BundleArchivedEvent,
  BundlePublishedEvent,
  BundleUnpublishedEvent,
  BundleItemsUpdatedEvent,
  BundleDetailsUpdatedEvent,
  BundleMetadataUpdatedEvent,
  BundlePriceUpdatedEvent,
  BundleCollectionsUpdatedEvent,
  BundleImagesUpdatedEvent,
  BundleSlugChangedEvent,
  BundleTaxDetailsUpdatedEvent,
  type BundleState,
  type BundleEvent,
  type BundleItem,
} from "./events";
import { ImageCollection } from "../_base/imageCollection";
import type { ImageUploadResult } from "../../infrastructure/adapters/imageStorageAdapter";

type BundleAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string;
  slug: string;
  items: BundleItem[];
  price: number;
  compareAtPrice: number | null;
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  tags: string[];
  collections: string[];
  images: ImageCollection;
  taxable: boolean;
  taxId: string;
  version: number;
  events: BundleEvent[];
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
};

type CreateBundleAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  name: string;
  description: string;
  slug: string;
  items: BundleItem[];
  price: number;
  compareAtPrice?: number | null;
  metaTitle?: string;
  metaDescription?: string;
  richDescriptionUrl?: string;
  tags?: string[];
  collections?: string[];
  taxable?: boolean;
  taxId?: string;
};

export class BundleAggregate {
  public id: string;
  public version: number = 0;
  public events: BundleEvent[];
  public uncommittedEvents: BundleEvent[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
  private name: string;
  private description: string;
  public slug: string;
  private items: BundleItem[];
  private price: number;
  private compareAtPrice: number | null;
  private metaTitle: string;
  private metaDescription: string;
  private richDescriptionUrl: string;
  private tags: string[];
  private _collections: string[];
  private images: ImageCollection;
  private taxable: boolean;
  private taxId: string;
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    name,
    description,
    slug,
    items,
    price,
    compareAtPrice,
    metaTitle,
    metaDescription,
    richDescriptionUrl,
    tags,
    collections,
    images,
    taxable,
    taxId,
    version = 0,
    events,
    status,
    publishedAt,
  }: BundleAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.name = name;
    this.description = description;
    this.slug = slug;
    this.items = items;
    this.price = price;
    this.compareAtPrice = compareAtPrice;
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.richDescriptionUrl = richDescriptionUrl;
    this.tags = tags;
    this._collections = collections;
    this.images = images;
    this.taxable = taxable;
    this.taxId = taxId;
    this.version = version;
    this.events = events;
    this.status = status;
    this.publishedAt = publishedAt;
  }

  get collections(): string[] {
    return [...this._collections];
  }

  static create({
    id,
    correlationId,
    userId,
    name,
    description,
    slug,
    items,
    price,
    compareAtPrice = null,
    metaTitle = "",
    metaDescription = "",
    richDescriptionUrl = "",
    tags = [],
    collections = [],
    taxable = true,
    taxId = "",
  }: CreateBundleAggregateParams) {
    const createdAt = new Date();
    const bundleAggregate = new BundleAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      name,
      description,
      slug,
      items,
      price,
      compareAtPrice,
      metaTitle,
      metaDescription,
      richDescriptionUrl,
      tags,
      collections,
      images: ImageCollection.empty(),
      taxable,
      taxId,
      version: 0,
      events: [],
      status: "draft",
      publishedAt: null,
    });
    const priorState = {} as BundleState;
    const newState = bundleAggregate.toState();
    const bundleCreatedEvent = new BundleCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    bundleAggregate.uncommittedEvents.push(bundleCreatedEvent);
    return bundleAggregate;
  }

  private toState(): BundleState {
    return {
      name: this.name,
      description: this.description,
      slug: this.slug,
      items: [...this.items],
      price: this.price,
      compareAtPrice: this.compareAtPrice,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      richDescriptionUrl: this.richDescriptionUrl,
      tags: [...this.tags],
      collections: [...this._collections],
      images: this.images,
      taxable: this.taxable,
      taxId: this.taxId,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  archive(userId: string) {
    if (this.status === "archived") {
      throw new Error("Bundle is already archived");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const archivedEvent = new BundleArchivedEvent({
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
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived bundle");
    }
    if (this.status === "active") {
      throw new Error("Bundle is already published");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const publishedEvent = new BundlePublishedEvent({
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
      throw new Error("Cannot unpublish an archived bundle");
    }
    if (this.status === "draft") {
      throw new Error("Bundle is already unpublished");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "draft";
    this.publishedAt = null;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const unpublishedEvent = new BundleUnpublishedEvent({
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

  updateItems(items: BundleItem[], userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.items = [...items];
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleItemsUpdatedEvent({
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

  updateDetails(name: string, description: string, richDescriptionUrl: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.name = name;
    this.description = description;
    this.richDescriptionUrl = richDescriptionUrl;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleDetailsUpdatedEvent({
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

  updateMetadata(metaTitle: string, metaDescription: string, tags: string[], userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.tags = [...tags];
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleMetadataUpdatedEvent({
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

  updatePrice(price: number, compareAtPrice: number | null, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.price = price;
    this.compareAtPrice = compareAtPrice;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundlePriceUpdatedEvent({
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

  updateCollections(collections: string[], userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this._collections = [...collections];
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleCollectionsUpdatedEvent({
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

  changeSlug(newSlug: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.slug = newSlug;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleSlugChangedEvent({
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

  updateTaxDetails(taxable: boolean, taxId: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.taxable = taxable;
    this.taxId = taxId;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleTaxDetailsUpdatedEvent({
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

  // Image methods
  addImage(uploadResult: ImageUploadResult, altText: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.images = this.images.addImage(uploadResult, altText);
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleImagesUpdatedEvent({
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

  removeImage(imageId: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.images = this.images.removeImage(imageId);
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleImagesUpdatedEvent({
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

  reorderImages(orderedIds: string[], userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.images = this.images.reorder(orderedIds);
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleImagesUpdatedEvent({
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

  updateImageAltText(imageId: string, altText: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.images = this.images.updateAltText(imageId, altText);
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new BundleImagesUpdatedEvent({
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

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new BundleAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      items: payload.items ?? [],
      price: payload.price,
      compareAtPrice: payload.compareAtPrice ?? null,
      metaTitle: payload.metaTitle ?? "",
      metaDescription: payload.metaDescription ?? "",
      richDescriptionUrl: payload.richDescriptionUrl ?? "",
      tags: payload.tags ?? [],
      collections: payload.collections ?? [],
      images: ImageCollection.fromJSON(payload.images),
      taxable: payload.taxable ?? true,
      taxId: payload.taxId ?? "",
      version: snapshot.version,
      events: [],
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
      items: this.items,
      price: this.price,
      compareAtPrice: this.compareAtPrice,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      richDescriptionUrl: this.richDescriptionUrl,
      tags: this.tags,
      collections: this._collections,
      images: this.images.toJSON(),
      taxable: this.taxable,
      taxId: this.taxId,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
