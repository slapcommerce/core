import type { DomainEvent } from "../_base/domainEvent";
import { SkuReservedEvent, SkuReleasedEvent, type SkuState } from "./skuEvents";

type SkuAggregateParams = {
  id: string; // The SKU itself
  correlationId: string;
  version: number;
  events: DomainEvent<string, Record<string, unknown>>[];
  sku: string;
  variantId: string | null;
  status: "active" | "released";
};

type CreateSkuAggregateParams = {
  sku: string;
  correlationId: string;
};

export class SkuAggregate {
  public id: string; // The SKU itself
  public version: number = 0;
  public events: DomainEvent<string, Record<string, unknown>>[];
  public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
  private correlationId: string;
  private sku: string;
  private variantId: string | null;
  private status: "active" | "released";

  constructor({
    id,
    correlationId,
    version = 0,
    events,
    sku,
    variantId,
    status,
  }: SkuAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.events = events;
    this.sku = sku;
    this.variantId = variantId;
    this.status = status;
  }

  static create({ sku, correlationId }: CreateSkuAggregateParams) {
    const skuAggregate = new SkuAggregate({
      id: sku,
      correlationId,
      version: 0,
      events: [],
      sku,
      variantId: null,
      status: "active",
    });
    return skuAggregate;
  }

  apply(event: DomainEvent<string, Record<string, unknown>>) {
    switch (event.eventName) {
      case "sku.reserved":
        const reservedEvent = event as SkuReservedEvent;
        const reservedState = reservedEvent.payload.newState;
        this.variantId = reservedState.variantId;
        this.status = reservedState.status;
        break;
      case "sku.released":
        const releasedEvent = event as SkuReleasedEvent;
        const releasedState = releasedEvent.payload.newState;
        this.variantId = releasedState.variantId;
        this.status = releasedState.status;
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventName}`);
    }
    this.version++;
    this.events.push(event);
  }

  isSkuAvailable(): boolean {
    return this.variantId === null;
  }

  private toState(): SkuState {
    return {
      sku: this.sku,
      variantId: this.variantId,
      status: this.status,
    };
  }

  reserveSku(variantId: string, userId: string) {
    if (!this.isSkuAvailable()) {
      throw new Error(`SKU "${this.sku}" is already in use`);
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.variantId = variantId;
    this.status = "active";
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const reservedEvent = new SkuReservedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(reservedEvent);
    return this;
  }

  releaseSku(userId: string) {
    if (this.status === "released") {
      // Already released, silently ignore (idempotent)
      return this;
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.variantId = null;
    this.status = "released";
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const releasedEvent = new SkuReleasedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(releasedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregate_id: string;
    correlation_id: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new SkuAggregate({
      id: snapshot.aggregate_id,
      correlationId: snapshot.correlation_id,
      version: snapshot.version,
      events: [],
      sku: payload.sku,
      variantId: payload.variantId ?? null,
      status: payload.status ?? "active",
    });
  }

  toSnapshot() {
    return {
      sku: this.sku,
      variantId: this.variantId,
      status: this.status,
    };
  }
}

