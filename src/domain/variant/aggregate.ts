import type { DomainEvent } from "../_base/domainEvent";
import { VariantCreatedEvent, VariantArchivedEvent, VariantDetailsUpdatedEvent, VariantPriceUpdatedEvent, VariantInventoryUpdatedEvent, VariantSkuUpdatedEvent, VariantPublishedEvent, VariantImagesUpdatedEvent, VariantDigitalAssetAttachedEvent, VariantDigitalAssetDetachedEvent, type VariantState, type DigitalAsset } from "./events";
import { ImageCollection } from "../_base/imageCollection";
import type { ImageUploadResult } from "../../infrastructure/adapters/imageStorageAdapter";

type VariantAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  productId: string;
  sku: string;
  price: number;
  inventory: number;
  options: Record<string, string>;
  version: number;
  events: DomainEvent[];
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
  images: ImageCollection;
  digitalAsset: DigitalAsset | null;
};

type CreateVariantAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  productId: string;
  sku?: string;
  price?: number;
  inventory?: number;
  options?: Record<string, string>;
};

export class VariantAggregate {
  public id: string;
  public version: number = 0;
  public events: DomainEvent[];
  public uncommittedEvents: DomainEvent[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
  private productId: string;
  private sku: string;
  private price: number;
  private inventory: number;
  private options: Record<string, string>;
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;
  public images: ImageCollection;
  public digitalAsset: DigitalAsset | null;

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    productId,
    sku,
    price,
    inventory,
    options,
    version = 0,
    events,
    status,
    publishedAt,
    images,
    digitalAsset,
  }: VariantAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.productId = productId;
    this.sku = sku;
    this.price = price;
    this.inventory = inventory;
    this.options = options;
    this.version = version;
    this.events = events;
    this.status = status;
    this.publishedAt = publishedAt;
    this.images = images;
    this.digitalAsset = digitalAsset;
  }

  static create({
    id,
    correlationId,
    userId,
    productId,
    sku = "",
    price = 0,
    inventory = 0,
    options = {},
  }: CreateVariantAggregateParams) {
    const createdAt = new Date();
    const variantAggregate = new VariantAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      productId,
      sku,
      price,
      inventory,
      options,
      version: 0,
      events: [],
      status: "draft",
      publishedAt: null,
      images: ImageCollection.empty(),
      digitalAsset: null,
    });
    const priorState = {} as VariantState;
    const newState = variantAggregate.toState();
    const variantCreatedEvent = new VariantCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    variantAggregate.uncommittedEvents.push(variantCreatedEvent);
    return variantAggregate;
  }

  apply(event: DomainEvent) {
    switch (event.eventName) {
      case "variant.created":
        const createdEvent = event as VariantCreatedEvent;
        const createdState = createdEvent.payload.newState;
        this.productId = createdState.productId;
        this.sku = createdState.sku;
        this.price = createdState.price;
        this.inventory = createdState.inventory;
        this.options = createdState.options;
        this.status = createdState.status;
        this.createdAt = createdState.createdAt;
        this.updatedAt = createdState.updatedAt;
        this.publishedAt = createdState.publishedAt;
        this.digitalAsset = createdState.digitalAsset;
        break;
      case "variant.archived":
        const archivedEvent = event as VariantArchivedEvent;
        const archivedState = archivedEvent.payload.newState;
        this.status = archivedState.status;
        this.updatedAt = archivedState.updatedAt;
        break;
      case "variant.published":
        const publishedEvent = event as VariantPublishedEvent;
        const publishedState = publishedEvent.payload.newState;
        this.status = publishedState.status;
        this.publishedAt = publishedState.publishedAt;
        this.updatedAt = publishedState.updatedAt;
        break;
      case "variant.details_updated":
        const detailsUpdatedEvent = event as VariantDetailsUpdatedEvent;
        const detailsUpdatedState = detailsUpdatedEvent.payload.newState;
        this.options = detailsUpdatedState.options;
        this.updatedAt = detailsUpdatedState.updatedAt;
        break;
      case "variant.price_updated":
        const priceUpdatedEvent = event as VariantPriceUpdatedEvent;
        const priceUpdatedState = priceUpdatedEvent.payload.newState;
        this.price = priceUpdatedState.price;
        this.updatedAt = priceUpdatedState.updatedAt;
        break;
      case "variant.inventory_updated":
        const inventoryUpdatedEvent = event as VariantInventoryUpdatedEvent;
        const inventoryUpdatedState = inventoryUpdatedEvent.payload.newState;
        this.inventory = inventoryUpdatedState.inventory;
        this.updatedAt = inventoryUpdatedState.updatedAt;
        break;
      case "variant.sku_updated":
        const skuUpdatedEvent = event as VariantSkuUpdatedEvent;
        const skuUpdatedState = skuUpdatedEvent.payload.newState;
        this.sku = skuUpdatedState.sku;
        this.updatedAt = skuUpdatedState.updatedAt;
        break;
      case "variant.images_updated":
        const imagesUpdatedEvent = event as VariantImagesUpdatedEvent;
        const imagesUpdatedState = imagesUpdatedEvent.payload.newState;
        this.images = imagesUpdatedState.images;
        this.updatedAt = imagesUpdatedState.updatedAt;
        break;
      case "variant.digital_asset_attached":
        const assetAttachedEvent = event as VariantDigitalAssetAttachedEvent;
        const assetAttachedState = assetAttachedEvent.payload.newState;
        this.digitalAsset = assetAttachedState.digitalAsset;
        this.updatedAt = assetAttachedState.updatedAt;
        break;
      case "variant.digital_asset_detached":
        const assetDetachedEvent = event as VariantDigitalAssetDetachedEvent;
        const assetDetachedState = assetDetachedEvent.payload.newState;
        this.digitalAsset = assetDetachedState.digitalAsset;
        this.updatedAt = assetDetachedState.updatedAt;
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventName}`);
    }
    this.version++;
    this.events.push(event);
  }

  private toState(): VariantState {
    return {
      productId: this.productId,
      sku: this.sku,
      price: this.price,
      inventory: this.inventory,
      options: this.options,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      images: this.images,
      digitalAsset: this.digitalAsset,
    };
  }

  publish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived variant");
    }
    if (this.status === "active") {
      throw new Error("Variant is already published");
    }

    // Validate required fields for publishing
    if (!this.sku || this.sku.trim() === "") {
      throw new Error("Cannot publish variant without a SKU");
    }
    if (this.price < 0) {
      throw new Error("Cannot publish variant with negative price");
    }
    if (this.inventory < 0 && this.inventory !== -1) {
      // Allow -1 for digital products
      throw new Error("Cannot publish variant with negative inventory");
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
    const publishedEvent = new VariantPublishedEvent({
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
      throw new Error("Variant is already archived");
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
    const archivedEvent = new VariantArchivedEvent({
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

  updateDetails(options: Record<string, string>, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.options = options;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const detailsUpdatedEvent = new VariantDetailsUpdatedEvent({
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

  updatePrice(price: number, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.price = price;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const priceUpdatedEvent = new VariantPriceUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(priceUpdatedEvent);
    return this;
  }

  updateInventory(inventory: number, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.inventory = inventory;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const inventoryUpdatedEvent = new VariantInventoryUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(inventoryUpdatedEvent);
    return this;
  }

  updateSku(sku: string, userId: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.sku = sku;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const skuUpdatedEvent = new VariantSkuUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(skuUpdatedEvent);
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
    const imagesUpdatedEvent = new VariantImagesUpdatedEvent({
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

  attachDigitalAsset(asset: DigitalAsset, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.digitalAsset = asset;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new VariantDigitalAssetAttachedEvent({
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

  detachDigitalAsset(userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.digitalAsset = null;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new VariantDigitalAssetDetachedEvent({
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

  forceInventoryReset(userId: string) {
    // This explicitly sets inventory to -1 (untracked/digital)
    return this.updateInventory(-1, userId);
  }

  static loadFromSnapshot(snapshot: {
    aggregate_id: string;
    correlation_id: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new VariantAggregate({
      id: snapshot.aggregate_id,
      correlationId: snapshot.correlation_id,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      productId: payload.productId,
      sku: payload.sku,
      price: payload.price,
      inventory: payload.inventory,
      options: payload.options,
      version: snapshot.version,
      events: [],
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      images: payload.images ? ImageCollection.fromJSON(payload.images) : ImageCollection.empty(),
      digitalAsset: payload.digitalAsset ?? null,
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      price: this.price,
      inventory: this.inventory,
      options: this.options,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
      images: this.images.toJSON(),
      digitalAsset: this.digitalAsset,
    };
  }
}

