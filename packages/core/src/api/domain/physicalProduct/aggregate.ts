import {
  ProductAggregate,
  type ProductEventParams,
} from "../product/ProductAggregate";
import {
  PhysicalProductCreatedEvent,
  PhysicalProductArchivedEvent,
  PhysicalProductPublishedEvent,
  PhysicalProductUnpublishedEvent,
  PhysicalProductSlugChangedEvent,
  PhysicalProductDetailsUpdatedEvent,
  PhysicalProductMetadataUpdatedEvent,
  PhysicalProductClassificationUpdatedEvent,
  PhysicalProductTagsUpdatedEvent,
  PhysicalProductCollectionsUpdatedEvent,
  PhysicalProductVariantOptionsUpdatedEvent,
  PhysicalProductTaxDetailsUpdatedEvent,
  PhysicalProductDefaultVariantSetEvent,
  type PhysicalProductState,
  type PhysicalProductEvent,
} from "./events";

type CreatePhysicalProductAggregateParams = {
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
};

export class PhysicalProductAggregate extends ProductAggregate<
  PhysicalProductState,
  PhysicalProductEvent
> {
  public readonly productType = "physical" as const;

  protected createArchivedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductArchivedEvent(params);
  }

  protected createPublishedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductPublishedEvent(params);
  }

  protected createUnpublishedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductUnpublishedEvent(params);
  }

  protected createSlugChangedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductSlugChangedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductDetailsUpdatedEvent(params);
  }

  protected createMetadataUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductMetadataUpdatedEvent(params);
  }

  protected createClassificationUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductClassificationUpdatedEvent(params);
  }

  protected createTagsUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductTagsUpdatedEvent(params);
  }

  protected createCollectionsUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductCollectionsUpdatedEvent(params);
  }

  protected createVariantOptionsUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductVariantOptionsUpdatedEvent(params);
  }

  protected createTaxDetailsUpdatedEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductTaxDetailsUpdatedEvent(params);
  }

  protected createDefaultVariantSetEvent(params: ProductEventParams<PhysicalProductState>) {
    return new PhysicalProductDefaultVariantSetEvent(params);
  }

  protected toState(): PhysicalProductState {
    return {
      ...this.baseState(),
      productType: this.productType,
    };
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
  }: CreatePhysicalProductAggregateParams) {
    if (collections.length === 0) {
      throw new Error("Product must belong to at least one collection");
    }

    const createdAt = new Date();
    const productAggregate = new PhysicalProductAggregate({
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
    });
    const priorState = {} as PhysicalProductState;
    const newState = productAggregate.toState();
    const productCreatedEvent = new PhysicalProductCreatedEvent({
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
    return new PhysicalProductAggregate({
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
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      productType: this.productType,
    };
  }
}
