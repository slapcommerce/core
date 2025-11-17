import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type VariantState = {
  productId: string;
  sku: string;
  title: string;
  price: number;
  inventory: number;
  options: Record<string, string>; // e.g., { size: "Large", color: "Red" }
  barcode: string | null;
  weight: number | null;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  [key: string]: any;
};

export type VariantEventPayload = StateBasedPayload<VariantState>;

type VariantCreatedEventType = DomainEvent<
  "variant.created",
  VariantEventPayload
>;

type VariantCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantCreatedEvent implements VariantCreatedEventType {
  occurredAt: Date;
  eventName = "variant.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: VariantEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type VariantArchivedEventType = DomainEvent<
  "variant.archived",
  VariantEventPayload
>;

type VariantArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantArchivedEvent implements VariantArchivedEventType {
  occurredAt: Date;
  eventName = "variant.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: VariantEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantArchivedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type VariantDetailsUpdatedEventType = DomainEvent<
  "variant.details_updated",
  VariantEventPayload
>;

type VariantDetailsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantDetailsUpdatedEvent implements VariantDetailsUpdatedEventType {
  occurredAt: Date;
  eventName = "variant.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: VariantEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantDetailsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type VariantPriceUpdatedEventType = DomainEvent<
  "variant.price_updated",
  VariantEventPayload
>;

type VariantPriceUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantPriceUpdatedEvent implements VariantPriceUpdatedEventType {
  occurredAt: Date;
  eventName = "variant.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: VariantEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPriceUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type VariantInventoryUpdatedEventType = DomainEvent<
  "variant.inventory_updated",
  VariantEventPayload
>;

type VariantInventoryUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantInventoryUpdatedEvent implements VariantInventoryUpdatedEventType {
  occurredAt: Date;
  eventName = "variant.inventory_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: VariantEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantInventoryUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type VariantPublishedEventType = DomainEvent<
  "variant.published",
  VariantEventPayload
>;

type VariantPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantPublishedEvent implements VariantPublishedEventType {
  occurredAt: Date;
  eventName = "variant.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: VariantEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantPublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

