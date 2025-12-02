import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ProductState } from "../product/aggregate";

export interface DigitalDownloadableProductState extends ProductState {
  productType: "digital_downloadable";
  maxDownloads: number | null;
  accessDurationDays: number | null;
}

type DigitalDownloadableProductEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: DigitalDownloadableProductState;
  newState: DigitalDownloadableProductState;
};

export class DigitalDownloadableProductCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductSlugChangedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductClassificationUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.classification_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductTagsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.tags_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductCollectionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductVariantOptionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.variant_options_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductTaxDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.tax_details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductDefaultVariantSetEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.default_variant_set" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductDownloadSettingsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.download_settings_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductHiddenDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.hidden_drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalDownloadableProductVisibleDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_downloadable_product.visible_drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalDownloadableProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalDownloadableProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type DigitalDownloadableProductEvent =
  | DigitalDownloadableProductCreatedEvent
  | DigitalDownloadableProductArchivedEvent
  | DigitalDownloadableProductPublishedEvent
  | DigitalDownloadableProductUnpublishedEvent
  | DigitalDownloadableProductSlugChangedEvent
  | DigitalDownloadableProductDetailsUpdatedEvent
  | DigitalDownloadableProductMetadataUpdatedEvent
  | DigitalDownloadableProductClassificationUpdatedEvent
  | DigitalDownloadableProductTagsUpdatedEvent
  | DigitalDownloadableProductCollectionsUpdatedEvent
  | DigitalDownloadableProductVariantOptionsUpdatedEvent
  | DigitalDownloadableProductTaxDetailsUpdatedEvent
  | DigitalDownloadableProductDefaultVariantSetEvent
  | DigitalDownloadableProductDownloadSettingsUpdatedEvent
  | DigitalDownloadableProductHiddenDropScheduledEvent
  | DigitalDownloadableProductVisibleDropScheduledEvent;
