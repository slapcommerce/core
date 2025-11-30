import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ProductState } from "../product/ProductAggregate";

export interface DigitalProductState extends ProductState {
  productType: "digital";
}

type DigitalProductEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: DigitalProductState;
  newState: DigitalProductState;
};

export class DigitalProductCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductSlugChangedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductClassificationUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.classification_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductTagsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.tags_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductCollectionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductVariantOptionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.variant_options_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductTaxDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.tax_details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DigitalProductDefaultVariantSetEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "digital_product.default_variant_set" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DigitalProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: DigitalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type DigitalProductEvent =
  | DigitalProductCreatedEvent
  | DigitalProductArchivedEvent
  | DigitalProductPublishedEvent
  | DigitalProductUnpublishedEvent
  | DigitalProductSlugChangedEvent
  | DigitalProductDetailsUpdatedEvent
  | DigitalProductMetadataUpdatedEvent
  | DigitalProductClassificationUpdatedEvent
  | DigitalProductTagsUpdatedEvent
  | DigitalProductCollectionsUpdatedEvent
  | DigitalProductVariantOptionsUpdatedEvent
  | DigitalProductTaxDetailsUpdatedEvent
  | DigitalProductDefaultVariantSetEvent;
