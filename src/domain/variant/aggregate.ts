import type { DomainEvent } from "../_base/domainEvent";
import { VariantCreatedEvent, VariantArchivedEvent, VariantDetailsUpdatedEvent, VariantPriceUpdatedEvent, VariantInventoryUpdatedEvent, VariantPublishedEvent, type VariantState } from "./events";

type VariantAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  productId: string;
  sku: string;
  title: string;
  price: number;
  inventory: number;
  options: Record<string, string>;
  barcode: string | null;
  weight: number | null;
  version: number;
  events: DomainEvent<string, Record<string, unknown>>[];
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
};

type CreateVariantAggregateParams = {
  id: string;
  correlationId: string;
  productId: string;
  sku: string;
  title: string;
  price: number;
  inventory: number;
  options: Record<string, string>;
  barcode: string | null;
  weight: number | null;
};

export class VariantAggregate {
  public id: string;
  public version: number = 0;
  public events: DomainEvent<string, Record<string, unknown>>[];
  public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
  private productId: string;
  private sku: string;
  private title: string;
  private price: number;
  private inventory: number;
  private options: Record<string, string>;
  private barcode: string | null;
  private weight: number | null;
  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    productId,
    sku,
    title,
    price,
    inventory,
    options,
    barcode,
    weight,
    version = 0,
    events,
    status,
    publishedAt,
  }: VariantAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.productId = productId;
    this.sku = sku;
    this.title = title;
    this.price = price;
    this.inventory = inventory;
    this.options = options;
    this.barcode = barcode;
    this.weight = weight;
    this.version = version;
    this.events = events;
    this.status = status;
    this.publishedAt = publishedAt;
  }

  static create({
    id,
    correlationId,
    productId,
    sku,
    title,
    price,
    inventory,
    options,
    barcode,
    weight,
  }: CreateVariantAggregateParams) {
    const createdAt = new Date();
    const variantAggregate = new VariantAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      productId,
      sku,
      title,
      price,
      inventory,
      options,
      barcode,
      weight,
      version: 0,
      events: [],
      status: "draft",
      publishedAt: null,
    });
    const priorState = {} as VariantState;
    const newState = variantAggregate.toState();
    const variantCreatedEvent = new VariantCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      priorState,
      newState,
    });
    variantAggregate.uncommittedEvents.push(variantCreatedEvent);
    return variantAggregate;
  }

  apply(event: DomainEvent<string, Record<string, unknown>>) {
    switch (event.eventName) {
      case "variant.created":
        const createdEvent = event as VariantCreatedEvent;
        const createdState = createdEvent.payload.newState;
        this.productId = createdState.productId;
        this.sku = createdState.sku;
        this.title = createdState.title;
        this.price = createdState.price;
        this.inventory = createdState.inventory;
        this.options = createdState.options;
        this.barcode = createdState.barcode;
        this.weight = createdState.weight;
        this.status = createdState.status;
        this.createdAt = createdState.createdAt;
        this.updatedAt = createdState.updatedAt;
        this.publishedAt = createdState.publishedAt;
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
        this.title = detailsUpdatedState.title;
        this.options = detailsUpdatedState.options;
        this.barcode = detailsUpdatedState.barcode;
        this.weight = detailsUpdatedState.weight;
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
      title: this.title,
      price: this.price,
      inventory: this.inventory,
      options: this.options,
      barcode: this.barcode,
      weight: this.weight,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
    };
  }

  publish() {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived variant");
    }
    if (this.status === "active") {
      throw new Error("Variant is already published");
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
      priorState,
      newState,
    });
    this.uncommittedEvents.push(publishedEvent);
    return this;
  }

  archive() {
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
      priorState,
      newState,
    });
    this.uncommittedEvents.push(archivedEvent);
    return this;
  }

  updateDetails(title: string, options: Record<string, string>, barcode: string | null, weight: number | null) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.title = title;
    this.options = options;
    this.barcode = barcode;
    this.weight = weight;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const detailsUpdatedEvent = new VariantDetailsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(detailsUpdatedEvent);
    return this;
  }

  updatePrice(price: number) {
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
      priorState,
      newState,
    });
    this.uncommittedEvents.push(priceUpdatedEvent);
    return this;
  }

  updateInventory(inventory: number) {
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
      priorState,
      newState,
    });
    this.uncommittedEvents.push(inventoryUpdatedEvent);
    return this;
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
      title: payload.title,
      price: payload.price,
      inventory: payload.inventory,
      options: payload.options,
      barcode: payload.barcode ?? null,
      weight: payload.weight ?? null,
      version: snapshot.version,
      events: [],
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      title: this.title,
      price: this.price,
      inventory: this.inventory,
      options: this.options,
      barcode: this.barcode,
      weight: this.weight,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}

