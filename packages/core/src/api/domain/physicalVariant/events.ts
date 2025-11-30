import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { VariantState } from "../variant/VariantAggregate";

export interface PhysicalVariantState extends VariantState {
  variantType: "physical";
  inventory: number;
}

type PhysicalVariantEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: PhysicalVariantState;
  newState: PhysicalVariantState;
};

export class PhysicalVariantCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantPriceUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantSkuUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.sku_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantInventoryUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.inventory_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalVariantImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_variant.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type PhysicalVariantEvent =
  | PhysicalVariantCreatedEvent
  | PhysicalVariantArchivedEvent
  | PhysicalVariantPublishedEvent
  | PhysicalVariantDetailsUpdatedEvent
  | PhysicalVariantPriceUpdatedEvent
  | PhysicalVariantSkuUpdatedEvent
  | PhysicalVariantInventoryUpdatedEvent
  | PhysicalVariantImagesUpdatedEvent;
