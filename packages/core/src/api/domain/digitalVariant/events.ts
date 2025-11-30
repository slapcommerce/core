import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { VariantState } from "../variant/VariantAggregate";

export type DigitalAsset = {
  name: string;
  fileKey: string;
  mimeType: string;
  size: number;
};

export interface DigitalVariantState extends VariantState {
  variantType: "digital";
  inventory: -1; // Always unlimited for digital variants
  digitalAsset: DigitalAsset | null;
}

type DigitalVariantEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: DigitalVariantState;
  newState: DigitalVariantState;
};

export class DigitalVariantCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantPriceUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantSkuUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.sku_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantDigitalAssetAttachedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.digital_asset_attached" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalVariantDigitalAssetDetachedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_variant.digital_asset_detached" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type DigitalVariantEvent =
  | DigitalVariantCreatedEvent
  | DigitalVariantArchivedEvent
  | DigitalVariantPublishedEvent
  | DigitalVariantDetailsUpdatedEvent
  | DigitalVariantPriceUpdatedEvent
  | DigitalVariantSkuUpdatedEvent
  | DigitalVariantImagesUpdatedEvent
  | DigitalVariantDigitalAssetAttachedEvent
  | DigitalVariantDigitalAssetDetachedEvent;
