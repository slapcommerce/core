import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { VariantState } from "../variant/aggregate";

export interface DropshipVariantState extends VariantState {
  variantType: "dropship";
  inventory: number;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
}

type DropshipVariantEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: DropshipVariantState;
  newState: DropshipVariantState;
};

export class DropshipVariantCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantPriceUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantSkuUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.sku_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantInventoryUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.inventory_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantFulfillmentSettingsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.fulfillment_settings_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantHiddenDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.hidden_drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class DropshipVariantVisibleDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.visible_drop_scheduled" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<DropshipVariantState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: DropshipVariantEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type DropshipVariantEvent =
  | DropshipVariantCreatedEvent
  | DropshipVariantArchivedEvent
  | DropshipVariantPublishedEvent
  | DropshipVariantDetailsUpdatedEvent
  | DropshipVariantPriceUpdatedEvent
  | DropshipVariantSkuUpdatedEvent
  | DropshipVariantInventoryUpdatedEvent
  | DropshipVariantImagesUpdatedEvent
  | DropshipVariantFulfillmentSettingsUpdatedEvent
  | DropshipVariantHiddenDropScheduledEvent
  | DropshipVariantVisibleDropScheduledEvent;
