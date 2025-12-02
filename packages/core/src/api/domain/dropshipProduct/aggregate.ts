import {
  ProductAggregate,
  type ProductEventParams,
  type ProductAggregateParams,
} from "../product/aggregate";
import {
  DropshipProductCreatedEvent,
  DropshipProductArchivedEvent,
  DropshipProductPublishedEvent,
  DropshipProductUnpublishedEvent,
  DropshipProductSlugChangedEvent,
  DropshipProductDetailsUpdatedEvent,
  DropshipProductMetadataUpdatedEvent,
  DropshipProductClassificationUpdatedEvent,
  DropshipProductTagsUpdatedEvent,
  DropshipProductCollectionsUpdatedEvent,
  DropshipProductVariantOptionsUpdatedEvent,
  DropshipProductTaxDetailsUpdatedEvent,
  DropshipProductDefaultVariantSetEvent,
  DropshipProductSafetyBufferUpdatedEvent,
  DropshipProductFulfillmentSettingsUpdatedEvent,
  DropshipProductHiddenDropScheduledEvent,
  DropshipProductVisibleDropScheduledEvent,
  type DropshipProductState,
  type DropshipProductEvent,
} from "./events";

type DropshipProductAggregateParams = ProductAggregateParams & {
  dropshipSafetyBuffer: number;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
};

type CreateDropshipProductAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  name: string;
  description: string;
  slug: string;
  collections: string[];
  variantPositionsAggregateId: string;
  richDescriptionUrl: string;
  vendor: string;
  variantOptions: { name: string; values: string[] }[];
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  taxable: boolean;
  taxId: string;
  dropshipSafetyBuffer?: number;
  fulfillmentProviderId?: string | null;
  supplierCost?: number | null;
  supplierSku?: string | null;
};

export class DropshipProductAggregate extends ProductAggregate<
  DropshipProductState,
  DropshipProductEvent
> {
  public readonly productType = "dropship" as const;
  private dropshipSafetyBuffer: number;
  public fulfillmentProviderId: string | null;
  public supplierCost: number | null;
  public supplierSku: string | null;

  constructor(params: DropshipProductAggregateParams) {
    super(params);
    this.dropshipSafetyBuffer = params.dropshipSafetyBuffer;
    this.fulfillmentProviderId = params.fulfillmentProviderId;
    this.supplierCost = params.supplierCost;
    this.supplierSku = params.supplierSku;
  }

  protected createArchivedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductArchivedEvent(params);
  }

  protected createPublishedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductPublishedEvent(params);
  }

  protected createUnpublishedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductUnpublishedEvent(params);
  }

  protected createSlugChangedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductSlugChangedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductDetailsUpdatedEvent(params);
  }

  protected createMetadataUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductMetadataUpdatedEvent(params);
  }

  protected createClassificationUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductClassificationUpdatedEvent(params);
  }

  protected createTagsUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductTagsUpdatedEvent(params);
  }

  protected createCollectionsUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductCollectionsUpdatedEvent(params);
  }

  protected createVariantOptionsUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductVariantOptionsUpdatedEvent(params);
  }

  protected createTaxDetailsUpdatedEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductTaxDetailsUpdatedEvent(params);
  }

  protected createDefaultVariantSetEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductDefaultVariantSetEvent(params);
  }

  protected createHiddenDropScheduledEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductHiddenDropScheduledEvent(params);
  }

  protected createVisibleDropScheduledEvent(params: ProductEventParams<DropshipProductState>) {
    return new DropshipProductVisibleDropScheduledEvent(params);
  }

  protected toState(): DropshipProductState {
    return {
      ...this.baseState(),
      productType: this.productType,
      dropshipSafetyBuffer: this.dropshipSafetyBuffer,
      fulfillmentProviderId: this.fulfillmentProviderId,
      supplierCost: this.supplierCost,
      supplierSku: this.supplierSku,
    };
  }

  protected override validatePublish(): void {
    if (this.dropshipSafetyBuffer < 0) {
      throw new Error("Dropship products must have a non-negative safety buffer");
    }
  }

  updateSafetyBuffer(dropshipSafetyBuffer: number, userId: string) {
    if (dropshipSafetyBuffer < 0) {
      throw new Error("Safety buffer must be non-negative");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.dropshipSafetyBuffer = dropshipSafetyBuffer;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DropshipProductSafetyBufferUpdatedEvent({
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

  updateFulfillmentSettings(
    fulfillmentProviderId: string | null,
    supplierCost: number | null,
    supplierSku: string | null,
    userId: string
  ) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.fulfillmentProviderId = fulfillmentProviderId;
    this.supplierCost = supplierCost;
    this.supplierSku = supplierSku;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DropshipProductFulfillmentSettingsUpdatedEvent({
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

  static create({
    id,
    correlationId,
    userId,
    name,
    description,
    slug,
    collections,
    variantPositionsAggregateId,
    richDescriptionUrl,
    vendor,
    variantOptions,
    metaTitle,
    metaDescription,
    tags,
    taxId,
    taxable,
    dropshipSafetyBuffer = 0,
    fulfillmentProviderId = null,
    supplierCost = null,
    supplierSku = null,
  }: CreateDropshipProductAggregateParams) {
    if (collections.length === 0) {
      throw new Error("Product must belong to at least one collection");
    }

    const createdAt = new Date();
    const productAggregate = new DropshipProductAggregate({
      id,
      correlationId,
      createdAt,
      name,
      description,
      slug,
      collections,
      variantPositionsAggregateId,
      defaultVariantId: null,
      richDescriptionUrl,
      version: 0,
      status: "draft",
      publishedAt: null,
      updatedAt: createdAt,
      vendor,
      variantOptions,
      metaTitle,
      metaDescription,
      tags,
      taxable,
      taxId,
      dropshipSafetyBuffer,
      fulfillmentProviderId,
      supplierCost,
      supplierSku,
    });
    const priorState = {} as DropshipProductState;
    const newState = productAggregate.toState();
    const productCreatedEvent = new DropshipProductCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    productAggregate.uncommittedEvents.push(productCreatedEvent);
    return productAggregate;
  }

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new DropshipProductAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      collections: payload.collections,
      variantPositionsAggregateId: payload.variantPositionsAggregateId,
      defaultVariantId: payload.defaultVariantId ?? null,
      richDescriptionUrl: payload.richDescriptionUrl,
      version: snapshot.version,
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      updatedAt: new Date(payload.updatedAt),
      vendor: payload.vendor,
      variantOptions: payload.variantOptions,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      tags: payload.tags,
      taxable: payload.taxable,
      taxId: payload.taxId,
      dropshipSafetyBuffer: payload.dropshipSafetyBuffer ?? 0,
      fulfillmentProviderId: payload.fulfillmentProviderId ?? null,
      supplierCost: payload.supplierCost ?? null,
      supplierSku: payload.supplierSku ?? null,
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      productType: this.productType,
      dropshipSafetyBuffer: this.dropshipSafetyBuffer,
      fulfillmentProviderId: this.fulfillmentProviderId,
      supplierCost: this.supplierCost,
      supplierSku: this.supplierSku,
    };
  }
}
