export type DomainEventPayload = Record<string, unknown>;

/**
 * Helper type for events that include prior and new state
 */
export type StateBasedPayload<T> = {
  priorState: T;
  newState: T;
};

/**
 * Union of all possible event types across all aggregates
 */
export type EventType =
  // Product events
  | "product.created"
  | "product.archived"
  | "product.published"
  | "product.unpublished"
  | "product.slug_changed"
  | "product.details_updated"
  | "product.metadata_updated"
  | "product.classification_updated"
  | "product.tags_updated"
  | "product.collections_updated"
  | "product.fulfillment_type_updated"
  | "product.variant_options_updated"
  | "product.update_product_tax_details"
  // Collection events
  | "collection.created"
  | "collection.archived"
  | "collection.metadata_updated"
  | "collection.published"
  | "collection.seo_metadata_updated"
  | "collection.unpublished"
  | "collection.images_updated"
  // Variant events
  | "variant.created"
  | "variant.archived"
  | "variant.details_updated"
  | "variant.price_updated"
  | "variant.inventory_updated"
  | "variant.sku_updated"
  | "variant.published"
  | "variant.images_updated"
  | "variant.digital_asset_attached"
  | "variant.digital_asset_detached"
  // Sku events
  | "sku.reserved"
  | "sku.released"
  // Slug events
  | "slug.reserved"
  | "slug.released"
  | "slug.redirected"
  // Schedule events
  | "schedule.created"
  | "schedule.updated"
  | "schedule.executed"
  | "schedule.failed"
  | "schedule.cancelled";

/**
 * Base interface for domain events
 */
export interface DomainEvent {
  occurredAt: Date;
  eventName: EventType;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: DomainEventPayload;
}

/**
 * Union type of all concrete domain event classes
 * This enables proper type narrowing in switch statements
 */
export type DomainEventUnion =
  | import("../product/events").ProductEvent
  | import("../variant/events").VariantEvent
  | import("../collection/events").CollectionEvent
  | import("../schedule/events").ScheduleEvent
  | import("../sku/skuEvents").SkuEvent
  | import("../slug/slugEvents").SlugEvent;
