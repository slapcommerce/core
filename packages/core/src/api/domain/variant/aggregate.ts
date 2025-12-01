import type { DomainEvent } from "../_base/domainEvent";
import { ImageCollection } from "../_base/imageCollection";

export interface VariantState {
  productId: string;
  sku: string;
  price: number;
  options: Record<string, string>;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  images: ImageCollection;
}

export type VariantEventParams<TState> = {
  occurredAt: Date;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  priorState: TState;
  newState: TState;
};

export type VariantAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  productId: string;
  sku: string;
  price: number;
  options: Record<string, string>;
  version: number;
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
  images: ImageCollection;
};

export abstract class VariantAggregate<
  TState extends VariantState,
  TEvent extends DomainEvent
> {
  public id: string;
  public version: number = 0;
  public uncommittedEvents: TEvent[] = [];
  protected correlationId: string;
  protected createdAt: Date;
  protected updatedAt: Date;
  protected productId: string;
  protected sku: string;
  protected price: number;
  protected options: Record<string, string>;
  protected status: "draft" | "active" | "archived";
  protected publishedAt: Date | null;
  public images: ImageCollection;

  constructor(params: VariantAggregateParams) {
    this.id = params.id;
    this.correlationId = params.correlationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.productId = params.productId;
    this.sku = params.sku;
    this.price = params.price;
    this.options = params.options;
    this.version = params.version;
    this.status = params.status;
    this.publishedAt = params.publishedAt;
    this.images = params.images;
  }

  // Abstract factory methods - subclasses provide type-specific events
  protected abstract createArchivedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createPublishedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createDetailsUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createPriceUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createSkuUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract createImagesUpdatedEvent(params: VariantEventParams<TState>): TEvent;
  protected abstract toState(): TState;

  protected baseState(): VariantState {
    return {
      productId: this.productId,
      sku: this.sku,
      price: this.price,
      options: this.options,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      images: this.images,
    };
  }

  archive(userId: string) {
    if (this.status === "archived") {
      throw new Error("Variant is already archived");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createArchivedEvent({
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

  publish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived variant");
    }
    if (this.status === "active") {
      throw new Error("Variant is already published");
    }
    this.validatePublish();

    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createPublishedEvent({
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

  protected validatePublish(): void {
    if (!this.sku || this.sku.trim() === "") {
      throw new Error("Cannot publish variant without a SKU");
    }
    if (this.price < 0) {
      throw new Error("Cannot publish variant with negative price");
    }
  }

  updateDetails(options: Record<string, string>, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.options = options;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createDetailsUpdatedEvent({
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

  updatePrice(price: number, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.price = price;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createPriceUpdatedEvent({
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

  updateSku(sku: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.sku = sku;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createSkuUpdatedEvent({
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

  updateImages(images: ImageCollection, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.images = images;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createImagesUpdatedEvent({
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

  toSnapshot() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      price: this.price,
      options: this.options,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
      images: this.images.toJSON(),
    };
  }
}
