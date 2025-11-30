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
  // Product events (DEPRECATED - use type-specific events)
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
  | "product.collection_positions_updated"
  | "product.fulfillment_type_updated"
  | "product.variant_options_updated"
  | "product.update_product_tax_details"
  | "product.default_variant_set"
  // Digital Downloadable Product events
  | "digital_downloadable_product.created"
  | "digital_downloadable_product.archived"
  | "digital_downloadable_product.published"
  | "digital_downloadable_product.unpublished"
  | "digital_downloadable_product.slug_changed"
  | "digital_downloadable_product.details_updated"
  | "digital_downloadable_product.metadata_updated"
  | "digital_downloadable_product.classification_updated"
  | "digital_downloadable_product.tags_updated"
  | "digital_downloadable_product.collections_updated"
  | "digital_downloadable_product.variant_options_updated"
  | "digital_downloadable_product.tax_details_updated"
  | "digital_downloadable_product.default_variant_set"
  | "digital_downloadable_product.download_settings_updated"
  // Dropship Product events
  | "dropship_product.created"
  | "dropship_product.archived"
  | "dropship_product.published"
  | "dropship_product.unpublished"
  | "dropship_product.slug_changed"
  | "dropship_product.details_updated"
  | "dropship_product.metadata_updated"
  | "dropship_product.classification_updated"
  | "dropship_product.tags_updated"
  | "dropship_product.collections_updated"
  | "dropship_product.variant_options_updated"
  | "dropship_product.tax_details_updated"
  | "dropship_product.default_variant_set"
  | "dropship_product.safety_buffer_updated"
  | "dropship_product.fulfillment_settings_updated"
  // Collection events
  | "collection.created"
  | "collection.archived"
  | "collection.metadata_updated"
  | "collection.published"
  | "collection.seo_metadata_updated"
  | "collection.unpublished"
  | "collection.images_updated"
  // ProductPositionsWithinCollection events
  | "productPositionsWithinCollection.created"
  | "productPositionsWithinCollection.reordered"
  | "productPositionsWithinCollection.product_added"
  | "productPositionsWithinCollection.product_removed"
  | "productPositionsWithinCollection.archived"
  // VariantPositionsWithinProduct events
  | "variantPositionsWithinProduct.created"
  | "variantPositionsWithinProduct.reordered"
  | "variantPositionsWithinProduct.variant_added"
  | "variantPositionsWithinProduct.variant_removed"
  | "variantPositionsWithinProduct.archived"
  // Variant events (DEPRECATED - use type-specific events)
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
  // Digital Downloadable Variant events
  | "digital_downloadable_variant.created"
  | "digital_downloadable_variant.archived"
  | "digital_downloadable_variant.published"
  | "digital_downloadable_variant.details_updated"
  | "digital_downloadable_variant.price_updated"
  | "digital_downloadable_variant.sku_updated"
  | "digital_downloadable_variant.images_updated"
  | "digital_downloadable_variant.digital_asset_attached"
  | "digital_downloadable_variant.digital_asset_detached"
  | "digital_downloadable_variant.download_settings_updated"
  // Dropship Variant events
  | "dropship_variant.created"
  | "dropship_variant.archived"
  | "dropship_variant.published"
  | "dropship_variant.details_updated"
  | "dropship_variant.price_updated"
  | "dropship_variant.sku_updated"
  | "dropship_variant.inventory_updated"
  | "dropship_variant.images_updated"
  | "dropship_variant.fulfillment_settings_updated"
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
  | "schedule.cancelled"
  // Bundle events
  | "bundle.created"
  | "bundle.archived"
  | "bundle.published"
  | "bundle.unpublished"
  | "bundle.items_updated"
  | "bundle.details_updated"
  | "bundle.metadata_updated"
  | "bundle.price_updated"
  | "bundle.collections_updated"
  | "bundle.images_updated"
  | "bundle.slug_changed"
  | "bundle.tax_details_updated";

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
  | import("../digitalDownloadableProduct/events").DigitalDownloadableProductEvent
  | import("../digitalDownloadableVariant/events").DigitalDownloadableVariantEvent
  | import("../dropshipProduct/events").DropshipProductEvent
  | import("../dropshipVariant/events").DropshipVariantEvent
  | import("../collection/events").CollectionEvent
  | import("../productPositionsWithinCollection/events").ProductPositionsWithinCollectionEvent
  | import("../variantPositionsWithinProduct/events").VariantPositionsWithinProductEvent
  | import("../schedule/events").ScheduleEvent
  | import("../sku/skuEvents").SkuEvent
  | import("../slug/slugEvents").SlugEvent
  | import("../bundle/events").BundleEvent;
