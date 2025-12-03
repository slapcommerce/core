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

export class DropshipVariantDropScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.drop_scheduled" as const;
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

export class DropshipVariantDroppedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.dropped" as const;
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

export class DropshipVariantScheduledDropUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.scheduled_drop_updated" as const;
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

export class DropshipVariantScheduledDropCancelledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.scheduled_drop_cancelled" as const;
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

export class DropshipVariantSaleUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.sale_updated" as const;
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

export class DropshipVariantSaleScheduledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.sale_scheduled" as const;
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

export class DropshipVariantScheduledSaleStartedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.scheduled_sale_started" as const;
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

export class DropshipVariantScheduledSaleEndedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.scheduled_sale_ended" as const;
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

export class DropshipVariantScheduledSaleUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.scheduled_sale_updated" as const;
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

export class DropshipVariantScheduledSaleCancelledEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "dropship_variant.scheduled_sale_cancelled" as const;
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
  | DropshipVariantSaleUpdatedEvent
  | DropshipVariantSkuUpdatedEvent
  | DropshipVariantInventoryUpdatedEvent
  | DropshipVariantImagesUpdatedEvent
  | DropshipVariantFulfillmentSettingsUpdatedEvent
  | DropshipVariantDropScheduledEvent
  | DropshipVariantDroppedEvent
  | DropshipVariantScheduledDropUpdatedEvent
  | DropshipVariantScheduledDropCancelledEvent
  | DropshipVariantSaleScheduledEvent
  | DropshipVariantScheduledSaleStartedEvent
  | DropshipVariantScheduledSaleEndedEvent
  | DropshipVariantScheduledSaleUpdatedEvent
  | DropshipVariantScheduledSaleCancelledEvent;
