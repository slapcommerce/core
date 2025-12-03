import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { VariantState } from "../variant/aggregate";

export type DigitalAsset = {
  name: string;
  fileKey: string;
  mimeType: string;
  size: number;
};

export interface DigitalDownloadableVariantState extends VariantState {
  variantType: "digital_downloadable";
  inventory: -1; // Always unlimited for digital variants
  digitalAsset: DigitalAsset | null;
  maxDownloads: number | null;
  accessDurationDays: number | null;
}

type DigitalDownloadableVariantEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: DigitalDownloadableVariantState;
  newState: DigitalDownloadableVariantState;
};

export class DigitalDownloadableVariantCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantPriceUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantSkuUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.sku_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantDigitalAssetAttachedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.digital_asset_attached" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantDigitalAssetDetachedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.digital_asset_detached" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantDownloadSettingsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.download_settings_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantDroppedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.dropped" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantScheduledDropUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.scheduled_drop_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantScheduledDropCancelledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.scheduled_drop_cancelled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantSaleUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.sale_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantSaleScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.sale_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantScheduledSaleStartedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.scheduled_sale_started" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantScheduledSaleEndedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.scheduled_sale_ended" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantScheduledSaleUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.scheduled_sale_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableVariantScheduledSaleCancelledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.scheduled_sale_cancelled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableVariantState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type DigitalDownloadableVariantEvent =
  | DigitalDownloadableVariantCreatedEvent
  | DigitalDownloadableVariantArchivedEvent
  | DigitalDownloadableVariantPublishedEvent
  | DigitalDownloadableVariantDetailsUpdatedEvent
  | DigitalDownloadableVariantPriceUpdatedEvent
  | DigitalDownloadableVariantSaleUpdatedEvent
  | DigitalDownloadableVariantSkuUpdatedEvent
  | DigitalDownloadableVariantImagesUpdatedEvent
  | DigitalDownloadableVariantDigitalAssetAttachedEvent
  | DigitalDownloadableVariantDigitalAssetDetachedEvent
  | DigitalDownloadableVariantDownloadSettingsUpdatedEvent
  | DigitalDownloadableVariantDropScheduledEvent
  | DigitalDownloadableVariantDroppedEvent
  | DigitalDownloadableVariantScheduledDropUpdatedEvent
  | DigitalDownloadableVariantScheduledDropCancelledEvent
  | DigitalDownloadableVariantSaleScheduledEvent
  | DigitalDownloadableVariantScheduledSaleStartedEvent
  | DigitalDownloadableVariantScheduledSaleEndedEvent
  | DigitalDownloadableVariantScheduledSaleUpdatedEvent
  | DigitalDownloadableVariantScheduledSaleCancelledEvent;
