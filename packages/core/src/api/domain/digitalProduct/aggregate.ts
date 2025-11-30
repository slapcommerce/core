import {
  ProductAggregate,
  type ProductEventParams,
} from "../product/ProductAggregate";
import {
  DigitalProductCreatedEvent,
  DigitalProductArchivedEvent,
  DigitalProductPublishedEvent,
  DigitalProductUnpublishedEvent,
  DigitalProductSlugChangedEvent,
  DigitalProductDetailsUpdatedEvent,
  DigitalProductMetadataUpdatedEvent,
  DigitalProductClassificationUpdatedEvent,
  DigitalProductTagsUpdatedEvent,
  DigitalProductCollectionsUpdatedEvent,
  DigitalProductVariantOptionsUpdatedEvent,
  DigitalProductTaxDetailsUpdatedEvent,
  DigitalProductDefaultVariantSetEvent,
  type DigitalProductState,
  type DigitalProductEvent,
} from "./events";

type CreateDigitalProductAggregateParams = {
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

export class DigitalProductAggregate extends ProductAggregate<
  DigitalProductState,
  DigitalProductEvent
> {
  public readonly productType = "digital" as const;

  protected createArchivedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductArchivedEvent(params);
  }

  protected createPublishedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductPublishedEvent(params);
  }

  protected createUnpublishedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductUnpublishedEvent(params);
  }

  protected createSlugChangedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductSlugChangedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductDetailsUpdatedEvent(params);
  }

  protected createMetadataUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductMetadataUpdatedEvent(params);
  }

  protected createClassificationUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductClassificationUpdatedEvent(params);
  }

  protected createTagsUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductTagsUpdatedEvent(params);
  }

  protected createCollectionsUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductCollectionsUpdatedEvent(params);
  }

  protected createVariantOptionsUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductVariantOptionsUpdatedEvent(params);
  }

  protected createTaxDetailsUpdatedEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductTaxDetailsUpdatedEvent(params);
  }

  protected createDefaultVariantSetEvent(params: ProductEventParams<DigitalProductState>) {
    return new DigitalProductDefaultVariantSetEvent(params);
  }

  protected toState(): DigitalProductState {
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
  }: CreateDigitalProductAggregateParams) {
    if (collections.length === 0) {
      throw new Error("Product must belong to at least one collection");
    }

    const createdAt = new Date();
    const productAggregate = new DigitalProductAggregate({
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
    const priorState = {} as DigitalProductState;
    const newState = productAggregate.toState();
    const productCreatedEvent = new DigitalProductCreatedEvent({
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
    return new DigitalProductAggregate({
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
