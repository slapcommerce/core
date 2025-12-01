import {
  VariantAggregate,
  type VariantEventParams,
  type VariantAggregateParams,
} from "../variant/aggregate";
import {
  DigitalDownloadableVariantCreatedEvent,
  DigitalDownloadableVariantArchivedEvent,
  DigitalDownloadableVariantPublishedEvent,
  DigitalDownloadableVariantDetailsUpdatedEvent,
  DigitalDownloadableVariantPriceUpdatedEvent,
  DigitalDownloadableVariantSkuUpdatedEvent,
  DigitalDownloadableVariantImagesUpdatedEvent,
  DigitalDownloadableVariantDigitalAssetAttachedEvent,
  DigitalDownloadableVariantDigitalAssetDetachedEvent,
  DigitalDownloadableVariantDownloadSettingsUpdatedEvent,
  type DigitalDownloadableVariantState,
  type DigitalAsset,
  type DigitalDownloadableVariantEvent,
} from "./events";
import { ImageCollection } from "../_base/imageCollection";

type DigitalDownloadableVariantAggregateParams = VariantAggregateParams & {
  digitalAsset: DigitalAsset | null;
  maxDownloads: number | null;
  accessDurationDays: number | null;
};

type CreateDigitalDownloadableVariantAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  productId: string;
  sku?: string;
  price?: number;
  options?: Record<string, string>;
  maxDownloads?: number | null;
  accessDurationDays?: number | null;
};

export class DigitalDownloadableVariantAggregate extends VariantAggregate<
  DigitalDownloadableVariantState,
  DigitalDownloadableVariantEvent
> {
  public readonly variantType = "digital_downloadable" as const;
  public readonly inventory = -1 as const; // Always unlimited for digital variants
  public digitalAsset: DigitalAsset | null;
  public maxDownloads: number | null;
  public accessDurationDays: number | null;

  constructor(params: DigitalDownloadableVariantAggregateParams) {
    super(params);
    this.digitalAsset = params.digitalAsset;
    this.maxDownloads = params.maxDownloads;
    this.accessDurationDays = params.accessDurationDays;
  }

  protected createArchivedEvent(params: VariantEventParams<DigitalDownloadableVariantState>) {
    return new DigitalDownloadableVariantArchivedEvent(params);
  }

  protected createPublishedEvent(params: VariantEventParams<DigitalDownloadableVariantState>) {
    return new DigitalDownloadableVariantPublishedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: VariantEventParams<DigitalDownloadableVariantState>) {
    return new DigitalDownloadableVariantDetailsUpdatedEvent(params);
  }

  protected createPriceUpdatedEvent(params: VariantEventParams<DigitalDownloadableVariantState>) {
    return new DigitalDownloadableVariantPriceUpdatedEvent(params);
  }

  protected createSkuUpdatedEvent(params: VariantEventParams<DigitalDownloadableVariantState>) {
    return new DigitalDownloadableVariantSkuUpdatedEvent(params);
  }

  protected createImagesUpdatedEvent(params: VariantEventParams<DigitalDownloadableVariantState>) {
    return new DigitalDownloadableVariantImagesUpdatedEvent(params);
  }

  protected toState(): DigitalDownloadableVariantState {
    return {
      ...this.baseState(),
      variantType: this.variantType,
      inventory: this.inventory,
      digitalAsset: this.digitalAsset,
      maxDownloads: this.maxDownloads,
      accessDurationDays: this.accessDurationDays,
    };
  }

  attachDigitalAsset(asset: DigitalAsset, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.digitalAsset = asset;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DigitalDownloadableVariantDigitalAssetAttachedEvent({
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

  detachDigitalAsset(userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.digitalAsset = null;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DigitalDownloadableVariantDigitalAssetDetachedEvent({
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
    const event = new DigitalDownloadableVariantDownloadSettingsUpdatedEvent({
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
    productId,
    sku = "",
    price = 0,
    options = {},
    maxDownloads = null,
    accessDurationDays = null,
  }: CreateDigitalDownloadableVariantAggregateParams) {
    const createdAt = new Date();
    const variantAggregate = new DigitalDownloadableVariantAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      productId,
      sku,
      price,
      options,
      version: 0,
      status: "draft",
      publishedAt: null,
      images: ImageCollection.empty(),
      digitalAsset: null,
      maxDownloads,
      accessDurationDays,
    });
    const priorState = {} as DigitalDownloadableVariantState;
    const newState = variantAggregate.toState();
    const variantCreatedEvent = new DigitalDownloadableVariantCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    variantAggregate.uncommittedEvents.push(variantCreatedEvent);
    return variantAggregate;
  }

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new DigitalDownloadableVariantAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      productId: payload.productId,
      sku: payload.sku,
      price: payload.price,
      options: payload.options,
      version: snapshot.version,
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      images: payload.images
        ? ImageCollection.fromJSON(payload.images)
        : ImageCollection.empty(),
      digitalAsset: payload.digitalAsset ?? null,
      maxDownloads: payload.maxDownloads ?? null,
      accessDurationDays: payload.accessDurationDays ?? null,
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      variantType: this.variantType,
      inventory: this.inventory,
      digitalAsset: this.digitalAsset,
      maxDownloads: this.maxDownloads,
      accessDurationDays: this.accessDurationDays,
    };
  }
}
