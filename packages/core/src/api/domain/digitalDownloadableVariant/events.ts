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

export class DigitalDownloadableVariantHiddenDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.hidden_drop_scheduled" as const;
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

export class DigitalDownloadableVariantVisibleDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_variant.visible_drop_scheduled" as const;
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
  | DigitalDownloadableVariantSkuUpdatedEvent
  | DigitalDownloadableVariantImagesUpdatedEvent
  | DigitalDownloadableVariantDigitalAssetAttachedEvent
  | DigitalDownloadableVariantDigitalAssetDetachedEvent
  | DigitalDownloadableVariantDownloadSettingsUpdatedEvent
  | DigitalDownloadableVariantHiddenDropScheduledEvent
  | DigitalDownloadableVariantVisibleDropScheduledEvent;
