import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type ProductState = {
  name: string;
  description: string;
  slug: string;
  collections: string[];  // Just collection IDs, positions owned by CollectionProductOrdering aggregate
  variantIds: string[];
  richDescriptionUrl: string;
  fulfillmentType: "digital" | "dropship";
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  taxable: boolean;
  taxId: string;
  dropshipSafetyBuffer?: number;
  status: "draft" | "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  [key: string]: any;
};

type ProductCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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



type ProductArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductPublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductPublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductUnpublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductSlugChangedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductSlugChangedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductDetailsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductClassificationUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductClassificationUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.classification_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductTagsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductTagsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.tags_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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


type ProductCollectionsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductCollectionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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

type ProductFulfillmentTypeUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductFulfillmentTypeUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.fulfillment_type_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

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

type variantsOptionsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class variantsOptionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.variant_options_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: variantsOptionsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

/**
 * Union of all product events
 */
type ProductUpdateProductTaxDetailsEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ProductState;
  newState: ProductState;
};

export class ProductUpdateProductTaxDetailsEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "product.update_product_tax_details" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<ProductState>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: ProductUpdateProductTaxDetailsEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type ProductEvent =
  | ProductCreatedEvent
  | ProductArchivedEvent
  | ProductPublishedEvent
  | ProductUnpublishedEvent
  | ProductSlugChangedEvent
  | ProductDetailsUpdatedEvent
  | ProductMetadataUpdatedEvent
  | ProductClassificationUpdatedEvent
  | ProductTagsUpdatedEvent
  | ProductCollectionsUpdatedEvent
  | ProductFulfillmentTypeUpdatedEvent
  | variantsOptionsUpdatedEvent
  | ProductUpdateProductTaxDetailsEvent;
