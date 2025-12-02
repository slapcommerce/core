import type { DomainEvent } from "../_base/domainEvent";

export type ProductStatus = "draft" | "active" | "archived" | "hidden_pending_drop" | "visible_pending_drop";

export interface ProductState {
  name: string;
  description: string;
  slug: string;
  collections: string[];
  variantPositionsAggregateId: string;
  defaultVariantId: string | null;
  richDescriptionUrl: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  taxable: boolean;
  taxId: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export type ProductEventParams<TState> = {
  occurredAt: Date;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  priorState: TState;
  newState: TState;
};

export type ProductAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string;
  slug: string;
  collections: string[];
  variantPositionsAggregateId: string;
  defaultVariantId: string | null;
  version: number;
  richDescriptionUrl: string;
  status: ProductStatus;
  publishedAt: Date | null;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  taxable: boolean;
  taxId: string;
};

export abstract class ProductAggregate<
  TState extends ProductState,
  TEvent extends DomainEvent
> {
  public id: string;
  public version: number = 0;
  public uncommittedEvents: TEvent[] = [];
  protected correlationId: string;
  protected createdAt: Date;
  protected updatedAt: Date;
  protected name: string;
  protected description: string;
  public slug: string;
  protected collections: string[];
  public variantPositionsAggregateId: string;
  public defaultVariantId: string | null;
  protected richDescriptionUrl: string;
  protected status: ProductStatus;
  protected publishedAt: Date | null;
  protected vendor: string;
  protected variantOptions: { name: string; values: string[] }[];
  protected metaTitle: string;
  protected metaDescription: string;
  protected tags: string[];
  protected taxable: boolean;
  protected taxId: string;

  constructor(params: ProductAggregateParams) {
    this.id = params.id;
    this.correlationId = params.correlationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.name = params.name;
    this.description = params.description;
    this.slug = params.slug;
    this.collections = params.collections;
    this.variantPositionsAggregateId = params.variantPositionsAggregateId;
    this.defaultVariantId = params.defaultVariantId;
    this.version = params.version;
    this.richDescriptionUrl = params.richDescriptionUrl;
    this.status = params.status;
    this.publishedAt = params.publishedAt;
    this.vendor = params.vendor;
    this.variantOptions = params.variantOptions;
    this.metaTitle = params.metaTitle;
    this.metaDescription = params.metaDescription;
    this.tags = params.tags;
    this.taxable = params.taxable;
    this.taxId = params.taxId;
  }

  // Abstract factory methods - subclasses provide type-specific events
  protected abstract createArchivedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createPublishedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createUnpublishedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createSlugChangedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createDetailsUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createMetadataUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createClassificationUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createTagsUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createCollectionsUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createVariantOptionsUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createTaxDetailsUpdatedEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createDefaultVariantSetEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createHiddenDropScheduledEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract createVisibleDropScheduledEvent(params: ProductEventParams<TState>): TEvent;
  protected abstract toState(): TState;

  protected baseState(): ProductState {
    return {
      name: this.name,
      description: this.description,
      slug: this.slug,
      collections: this.collections,
      variantPositionsAggregateId: this.variantPositionsAggregateId,
      defaultVariantId: this.defaultVariantId,
      richDescriptionUrl: this.richDescriptionUrl,
      vendor: this.vendor,
      variantOptions: this.variantOptions,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      tags: this.tags,
      taxable: this.taxable,
      taxId: this.taxId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
    };
  }

  archive(userId: string) {
    if (this.status === "archived") {
      throw new Error("Product is already archived");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  publish(userId: string, hasVariants: boolean = true) {
    if (!hasVariants) {
      throw new Error("Cannot publish product without at least one variant");
    }
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived product");
    }
    if (this.status === "active") {
      throw new Error("Product is already published");
    }
    // Skip validation if coming from pending_drop statuses (already validated)
    const isFromPendingDrop = this.status === "hidden_pending_drop" || this.status === "visible_pending_drop";
    if (!isFromPendingDrop) {
      this.validatePublish();
    }

    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createPublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  protected validatePublish(): void {
    // Override in subclasses for type-specific validation
  }

  unpublish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot unpublish an archived product");
    }
    if (this.status === "draft") {
      throw new Error("Product is already unpublished");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "draft";
    this.publishedAt = null;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createUnpublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  scheduleHiddenDrop(userId: string, hasVariants: boolean = true) {
    if (!hasVariants) {
      throw new Error("Cannot schedule drop on product without at least one variant");
    }
    if (this.status === "archived") {
      throw new Error("Cannot schedule drop on an archived product");
    }
    if (this.status === "hidden_pending_drop") {
      throw new Error("Product is already scheduled for hidden drop");
    }
    this.validatePublish();

    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "hidden_pending_drop";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createHiddenDropScheduledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  scheduleVisibleDrop(userId: string, hasVariants: boolean = true) {
    if (!hasVariants) {
      throw new Error("Cannot schedule drop on product without at least one variant");
    }
    if (this.status === "archived") {
      throw new Error("Cannot schedule drop on an archived product");
    }
    if (this.status === "visible_pending_drop") {
      throw new Error("Product is already scheduled for visible drop");
    }
    this.validatePublish();

    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "visible_pending_drop";
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createVisibleDropScheduledEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  changeSlug(newSlug: string, userId: string) {
    if (this.slug === newSlug) {
      throw new Error("New slug must be different from current slug");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.slug = newSlug;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createSlugChangedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateDetails(
    name: string,
    description: string,
    richDescriptionUrl: string,
    userId: string
  ) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.name = name;
    this.description = description;
    this.richDescriptionUrl = richDescriptionUrl;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createDetailsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateMetadata(metaTitle: string, metaDescription: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.metaTitle = metaTitle;
    this.metaDescription = metaDescription;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createMetadataUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateVendor(vendor: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.vendor = vendor;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createClassificationUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateTags(tags: string[], userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.tags = tags;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createTagsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateCollections(collections: string[], userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.collections = collections;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createCollectionsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateOptions(
    variantOptions: { name: string; values: string[] }[],
    userId: string
  ) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.variantOptions = variantOptions;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createVariantOptionsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  updateTaxDetails(taxable: boolean, taxId: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.taxable = taxable;
    this.taxId = taxId;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createTaxDetailsUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  setDefaultVariant(variantId: string, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.defaultVariantId = variantId;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createDefaultVariantSetEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  clearDefaultVariant(userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.defaultVariantId = null;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = this.createDefaultVariantSetEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }

  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
      collections: this.collections,
      variantPositionsAggregateId: this.variantPositionsAggregateId,
      defaultVariantId: this.defaultVariantId,
      richDescriptionUrl: this.richDescriptionUrl,
      vendor: this.vendor,
      variantOptions: this.variantOptions,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      tags: this.tags,
      taxable: this.taxable,
      taxId: this.taxId,
      status: this.status,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
