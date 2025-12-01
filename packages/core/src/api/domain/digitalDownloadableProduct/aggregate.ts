import {
  ProductAggregate,
  type ProductEventParams,
} from "../product/aggregate";
import {
  DigitalDownloadableProductCreatedEvent,
  DigitalDownloadableProductArchivedEvent,
  DigitalDownloadableProductPublishedEvent,
  DigitalDownloadableProductUnpublishedEvent,
  DigitalDownloadableProductSlugChangedEvent,
  DigitalDownloadableProductDetailsUpdatedEvent,
  DigitalDownloadableProductMetadataUpdatedEvent,
  DigitalDownloadableProductClassificationUpdatedEvent,
  DigitalDownloadableProductTagsUpdatedEvent,
  DigitalDownloadableProductCollectionsUpdatedEvent,
  DigitalDownloadableProductVariantOptionsUpdatedEvent,
  DigitalDownloadableProductTaxDetailsUpdatedEvent,
  DigitalDownloadableProductDefaultVariantSetEvent,
  DigitalDownloadableProductDownloadSettingsUpdatedEvent,
  type DigitalDownloadableProductState,
  type DigitalDownloadableProductEvent,
} from "./events";

type CreateDigitalDownloadableProductAggregateParams = {
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
  maxDownloads: number | null;
  accessDurationDays: number | null;
};

export class DigitalDownloadableProductAggregate extends ProductAggregate<
  DigitalDownloadableProductState,
  DigitalDownloadableProductEvent
> {
  public readonly productType = "digital_downloadable" as const;
  public maxDownloads: number | null;
  public accessDurationDays: number | null;

  constructor(
    params: ConstructorParameters<typeof ProductAggregate>[0] & {
      maxDownloads: number | null;
      accessDurationDays: number | null;
    }
  ) {
    super(params);
    this.maxDownloads = params.maxDownloads;
    this.accessDurationDays = params.accessDurationDays;
  }

  protected createArchivedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductArchivedEvent(params);
  }

  protected createPublishedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductPublishedEvent(params);
  }

  protected createUnpublishedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductUnpublishedEvent(params);
  }

  protected createSlugChangedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductSlugChangedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductDetailsUpdatedEvent(params);
  }

  protected createMetadataUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductMetadataUpdatedEvent(params);
  }

  protected createClassificationUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductClassificationUpdatedEvent(params);
  }

  protected createTagsUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductTagsUpdatedEvent(params);
  }

  protected createCollectionsUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductCollectionsUpdatedEvent(params);
  }

  protected createVariantOptionsUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductVariantOptionsUpdatedEvent(params);
  }

  protected createTaxDetailsUpdatedEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductTaxDetailsUpdatedEvent(params);
  }

  protected createDefaultVariantSetEvent(params: ProductEventParams<DigitalDownloadableProductState>) {
    return new DigitalDownloadableProductDefaultVariantSetEvent(params);
  }

  protected toState(): DigitalDownloadableProductState {
    return {
      ...this.baseState(),
      productType: this.productType,
      maxDownloads: this.maxDownloads,
      accessDurationDays: this.accessDurationDays,
    };
  }

  updateDownloadSettings(
    maxDownloads: number | null,
    accessDurationDays: number | null,
    userId: string
  ) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.maxDownloads = maxDownloads;
    this.accessDurationDays = accessDurationDays;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DigitalDownloadableProductDownloadSettingsUpdatedEvent({
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
    maxDownloads,
    accessDurationDays,
  }: CreateDigitalDownloadableProductAggregateParams) {
    if (collections.length === 0) {
      throw new Error("Product must belong to at least one collection");
    }

    const createdAt = new Date();
    const productAggregate = new DigitalDownloadableProductAggregate({
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
      maxDownloads,
      accessDurationDays,
    });
    const priorState = {} as DigitalDownloadableProductState;
    const newState = productAggregate.toState();
    const productCreatedEvent = new DigitalDownloadableProductCreatedEvent({
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
    return new DigitalDownloadableProductAggregate({
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
      maxDownloads: payload.maxDownloads ?? null,
      accessDurationDays: payload.accessDurationDays ?? null,
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      productType: this.productType,
      maxDownloads: this.maxDownloads,
      accessDurationDays: this.accessDurationDays,
    };
  }
}
