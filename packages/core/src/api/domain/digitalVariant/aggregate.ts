import {
  VariantAggregate,
  type VariantEventParams,
  type VariantAggregateParams,
} from "../variant/VariantAggregate";
import {
  DigitalVariantCreatedEvent,
  DigitalVariantArchivedEvent,
  DigitalVariantPublishedEvent,
  DigitalVariantDetailsUpdatedEvent,
  DigitalVariantPriceUpdatedEvent,
  DigitalVariantSkuUpdatedEvent,
  DigitalVariantImagesUpdatedEvent,
  DigitalVariantDigitalAssetAttachedEvent,
  DigitalVariantDigitalAssetDetachedEvent,
  type DigitalVariantState,
  type DigitalAsset,
  type DigitalVariantEvent,
} from "./events";
import { ImageCollection } from "../_base/imageCollection";

type DigitalVariantAggregateParams = VariantAggregateParams & {
  digitalAsset: DigitalAsset | null;
};

type CreateDigitalVariantAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  productId: string;
  sku?: string;
  price?: number;
  options?: Record<string, string>;
};

export class DigitalVariantAggregate extends VariantAggregate<
  DigitalVariantState,
  DigitalVariantEvent
> {
  public readonly variantType = "digital" as const;
  public readonly inventory = -1 as const; // Always unlimited for digital variants
  public digitalAsset: DigitalAsset | null;

  constructor(params: DigitalVariantAggregateParams) {
    super(params);
    this.digitalAsset = params.digitalAsset;
  }

  protected createArchivedEvent(params: VariantEventParams<DigitalVariantState>) {
    return new DigitalVariantArchivedEvent(params);
  }

  protected createPublishedEvent(params: VariantEventParams<DigitalVariantState>) {
    return new DigitalVariantPublishedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: VariantEventParams<DigitalVariantState>) {
    return new DigitalVariantDetailsUpdatedEvent(params);
  }

  protected createPriceUpdatedEvent(params: VariantEventParams<DigitalVariantState>) {
    return new DigitalVariantPriceUpdatedEvent(params);
  }

  protected createSkuUpdatedEvent(params: VariantEventParams<DigitalVariantState>) {
    return new DigitalVariantSkuUpdatedEvent(params);
  }

  protected createImagesUpdatedEvent(params: VariantEventParams<DigitalVariantState>) {
    return new DigitalVariantImagesUpdatedEvent(params);
  }

  protected toState(): DigitalVariantState {
    return {
      ...this.baseState(),
      variantType: this.variantType,
      inventory: this.inventory,
      digitalAsset: this.digitalAsset,
    };
  }

  attachDigitalAsset(asset: DigitalAsset, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.digitalAsset = asset;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DigitalVariantDigitalAssetAttachedEvent({
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
    const event = new DigitalVariantDigitalAssetDetachedEvent({
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
  }: CreateDigitalVariantAggregateParams) {
    const createdAt = new Date();
    const variantAggregate = new DigitalVariantAggregate({
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
    });
    const priorState = {} as DigitalVariantState;
    const newState = variantAggregate.toState();
    const variantCreatedEvent = new DigitalVariantCreatedEvent({
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
    return new DigitalVariantAggregate({
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
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      variantType: this.variantType,
      inventory: this.inventory,
      digitalAsset: this.digitalAsset,
    };
  }
}
