import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ProductState } from "../product/aggregate";

export interface DropshipProductState extends ProductState {
  productType: "dropship";
  dropshipSafetyBuffer: number;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
}

type DropshipProductEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: DropshipProductState;
  newState: DropshipProductState;
};

export class DropshipProductCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductSlugChangedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductClassificationUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.classification_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductTagsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.tags_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductCollectionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductVariantOptionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.variant_options_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductTaxDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.tax_details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductDefaultVariantSetEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.default_variant_set" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductSafetyBufferUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.safety_buffer_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductFulfillmentSettingsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.fulfillment_settings_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductHiddenDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.hidden_drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipProductVisibleDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_product.visible_drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipProductEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type DropshipProductEvent =
  | DropshipProductCreatedEvent
  | DropshipProductArchivedEvent
  | DropshipProductPublishedEvent
  | DropshipProductUnpublishedEvent
  | DropshipProductSlugChangedEvent
  | DropshipProductDetailsUpdatedEvent
  | DropshipProductMetadataUpdatedEvent
  | DropshipProductClassificationUpdatedEvent
  | DropshipProductTagsUpdatedEvent
  | DropshipProductCollectionsUpdatedEvent
  | DropshipProductVariantOptionsUpdatedEvent
  | DropshipProductTaxDetailsUpdatedEvent
  | DropshipProductDefaultVariantSetEvent
  | DropshipProductSafetyBufferUpdatedEvent
  | DropshipProductFulfillmentSettingsUpdatedEvent
  | DropshipProductHiddenDropScheduledEvent
  | DropshipProductVisibleDropScheduledEvent;
