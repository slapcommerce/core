import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ProductState } from "../product/ProductAggregate";

export interface PhysicalProductState extends ProductState {
  productType: "physical";
}

type PhysicalProductEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: PhysicalProductState;
  newState: PhysicalProductState;
};

export class PhysicalProductCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductSlugChangedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductClassificationUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.classification_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductTagsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.tags_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductCollectionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductVariantOptionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.variant_options_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductTaxDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.tax_details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class PhysicalProductDefaultVariantSetEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "physical_product.default_variant_set" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<PhysicalProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: PhysicalProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type PhysicalProductEvent =
  | PhysicalProductCreatedEvent
  | PhysicalProductArchivedEvent
  | PhysicalProductPublishedEvent
  | PhysicalProductUnpublishedEvent
  | PhysicalProductSlugChangedEvent
  | PhysicalProductDetailsUpdatedEvent
  | PhysicalProductMetadataUpdatedEvent
  | PhysicalProductClassificationUpdatedEvent
  | PhysicalProductTagsUpdatedEvent
  | PhysicalProductCollectionsUpdatedEvent
  | PhysicalProductVariantOptionsUpdatedEvent
  | PhysicalProductTaxDetailsUpdatedEvent
  | PhysicalProductDefaultVariantSetEvent;
