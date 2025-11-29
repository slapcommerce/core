import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { ImageCollection } from "../_base/imageCollection";

export type BundleItem = {
  variantId: string;
  quantity: number;
};

export type BundleState = {
  // Core identity
  name: string;
  description: string;
  slug: string;

  // Bundle items (variants with quantities)
  items: BundleItem[];

  // Pricing
  price: number;
  compareAtPrice: number | null;

  // SEO/Metadata
  metaTitle: string;
  metaDescription: string;
  richDescriptionUrl: string;
  tags: string[];

  // Collections
  collections: string[];

  // Images
  images: ImageCollection;

  // Tax
  taxable: boolean;
  taxId: string;

  // Status workflow
  status: "draft" | "active" | "archived";
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

type BundleCreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleCreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.created" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleCreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleArchivedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleArchivedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.archived" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleArchivedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundlePublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundlePublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.published" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundlePublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleUnpublishedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleUnpublishedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.unpublished" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleUnpublishedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleItemsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleItemsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.items_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleItemsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleDetailsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleDetailsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleMetadataUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleMetadataUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.metadata_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleMetadataUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundlePriceUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundlePriceUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.price_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundlePriceUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleCollectionsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleCollectionsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.collections_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleCollectionsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleImagesUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleImagesUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.images_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleImagesUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleSlugChangedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleSlugChangedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.slug_changed" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleSlugChangedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

type BundleTaxDetailsUpdatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: BundleState;
  newState: BundleState;
};

export class BundleTaxDetailsUpdatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "bundle.tax_details_updated" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<BundleState>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: BundleTaxDetailsUpdatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type BundleEvent =
  | BundleCreatedEvent
  | BundleArchivedEvent
  | BundlePublishedEvent
  | BundleUnpublishedEvent
  | BundleItemsUpdatedEvent
  | BundleDetailsUpdatedEvent
  | BundleMetadataUpdatedEvent
  | BundlePriceUpdatedEvent
  | BundleCollectionsUpdatedEvent
  | BundleImagesUpdatedEvent
  | BundleSlugChangedEvent
  | BundleTaxDetailsUpdatedEvent;
