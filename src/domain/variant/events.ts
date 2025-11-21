import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ImageCollection } from "../_base/imageCollection";

export type DigitalAsset = {
  name: string;
  fileKey: string;
  mimeType: string;
  size: number;
};

export type VariantState = {
  productId: string;
  sku: string;
  price: number;
  inventory: number;
  options: Record<string, string>; // e.g., { size: "Large", color: "Red" }
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  images: ImageCollection; // Collection of product images with alt text
  digitalAsset: DigitalAsset | null;
  [key: string]: any;
};



type VariantCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

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


type VariantArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

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


type VariantDetailsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

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


type VariantPriceUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantPriceUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

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


type VariantInventoryUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantInventoryUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.inventory_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

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


type VariantSkuUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantSkuUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.sku_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantSkuUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type VariantPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

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


type VariantImagesUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantImagesUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type VariantDigitalAssetAttachedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantDigitalAssetAttachedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.digital_asset_attached" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantDigitalAssetAttachedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


type VariantDigitalAssetDetachedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: VariantState;
  newState: VariantState;
};

export class VariantDigitalAssetDetachedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "variant.digital_asset_detached" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<VariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: VariantDigitalAssetDetachedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}


/**
 * Union of all variant events
 */
export type VariantEvent =
  | VariantCreatedEvent
  | VariantArchivedEvent
  | VariantDetailsUpdatedEvent
  | VariantPriceUpdatedEvent
  | VariantInventoryUpdatedEvent
  | VariantSkuUpdatedEvent
  | VariantPublishedEvent
  | VariantImagesUpdatedEvent
  | VariantDigitalAssetAttachedEvent
  | VariantDigitalAssetDetachedEvent;
