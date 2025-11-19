import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type ProductState = {
  title: string;
  shortDescription: string;
  slug: string;
  collectionIds: string[];
  variantIds: string[];
  richDescriptionUrl: string;
  productType: string;
  fulfillmentType: "digital" | "dropship";
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  requiresShipping: boolean;
  taxable: boolean;
  pageLayoutId: string | null;
  dropshipSafetyBuffer?: number;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  [key: string]: any;
};

export type ProductEventPayload = StateBasedPayload<ProductState>;

type ProductCreatedEventType = DomainEvent<
  "product.created",
  ProductEventPayload
>;

type ProductCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductCreatedEvent implements ProductCreatedEventType {
  occurredAt: Date;
  eventName = "product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductArchivedEventType = DomainEvent<
  "product.archived",
  ProductEventPayload
>;

type ProductArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductArchivedEvent implements ProductArchivedEventType {
  occurredAt: Date;
  eventName = "product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductArchivedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductPublishedEventType = DomainEvent<
  "product.published",
  ProductEventPayload
>;

type ProductPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductPublishedEvent implements ProductPublishedEventType {
  occurredAt: Date;
  eventName = "product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductUnpublishedEventType = DomainEvent<
  "product.unpublished",
  ProductEventPayload
>;

type ProductUnpublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductUnpublishedEvent implements ProductUnpublishedEventType {
  occurredAt: Date;
  eventName = "product.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductUnpublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductSlugChangedEventType = DomainEvent<
  "product.slug_changed",
  ProductEventPayload
>;

type ProductSlugChangedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductSlugChangedEvent implements ProductSlugChangedEventType {
  occurredAt: Date;
  eventName = "product.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductSlugChangedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductDetailsUpdatedEventType = DomainEvent<
  "product.details_updated",
  ProductEventPayload
>;

type ProductDetailsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductDetailsUpdatedEvent
  implements ProductDetailsUpdatedEventType {
  occurredAt: Date;
  eventName = "product.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductDetailsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductMetadataUpdatedEventType = DomainEvent<
  "product.metadata_updated",
  ProductEventPayload
>;

type ProductMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductMetadataUpdatedEvent
  implements ProductMetadataUpdatedEventType {
  occurredAt: Date;
  eventName = "product.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductMetadataUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductClassificationUpdatedEventType = DomainEvent<
  "product.classification_updated",
  ProductEventPayload
>;

type ProductClassificationUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductClassificationUpdatedEvent
  implements ProductClassificationUpdatedEventType {
  occurredAt: Date;
  eventName = "product.classification_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductClassificationUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductTagsUpdatedEventType = DomainEvent<
  "product.tags_updated",
  ProductEventPayload
>;

type ProductTagsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductTagsUpdatedEvent implements ProductTagsUpdatedEventType {
  occurredAt: Date;
  eventName = "product.tags_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductTagsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductCollectionsUpdatedEventType = DomainEvent<
  "product.collections_updated",
  ProductEventPayload
>;

type ProductCollectionsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductCollectionsUpdatedEvent
  implements ProductCollectionsUpdatedEventType {
  occurredAt: Date;
  eventName = "product.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductCollectionsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductShippingSettingsUpdatedEventType = DomainEvent<
  "product.shipping_settings_updated",
  ProductEventPayload
>;

type ProductShippingSettingsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductShippingSettingsUpdatedEvent
  implements ProductShippingSettingsUpdatedEventType {
  occurredAt: Date;
  eventName = "product.shipping_settings_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductShippingSettingsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductPageLayoutUpdatedEventType = DomainEvent<
  "product.page_layout_updated",
  ProductEventPayload
>;

type ProductPageLayoutUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

type ProductFulfillmentTypeUpdatedEventType = DomainEvent<
  "product.fulfillment_type_updated",
  ProductEventPayload
>;

type ProductFulfillmentTypeUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductFulfillmentTypeUpdatedEvent
  implements ProductFulfillmentTypeUpdatedEventType {
  occurredAt: Date;
  eventName = "product.fulfillment_type_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductFulfillmentTypeUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export class ProductPageLayoutUpdatedEvent
  implements ProductPageLayoutUpdatedEventType {
  occurredAt: Date;
  eventName = "product.page_layout_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductPageLayoutUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type ProductVariantOptionsUpdatedEventType = DomainEvent<
  "product.variant_options_updated",
  ProductEventPayload
>;

type ProductVariantOptionsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductVariantOptionsUpdatedEvent
  implements ProductVariantOptionsUpdatedEventType {
  occurredAt: Date;
  eventName = "product.variant_options_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: ProductEventPayload;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ProductVariantOptionsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}
