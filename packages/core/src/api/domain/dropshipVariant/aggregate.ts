import {
  VariantAggregate,
  type VariantEventParams,
  type VariantAggregateParams,
} from "../variant/VariantAggregate";
import {
  DropshipVariantCreatedEvent,
  DropshipVariantArchivedEvent,
  DropshipVariantPublishedEvent,
  DropshipVariantDetailsUpdatedEvent,
  DropshipVariantPriceUpdatedEvent,
  DropshipVariantSkuUpdatedEvent,
  DropshipVariantInventoryUpdatedEvent,
  DropshipVariantImagesUpdatedEvent,
  DropshipVariantFulfillmentSettingsUpdatedEvent,
  type DropshipVariantState,
  type DropshipVariantEvent,
} from "./events";
import { ImageCollection } from "../_base/imageCollection";

type DropshipVariantAggregateParams = VariantAggregateParams & {
  inventory: number;
  fulfillmentProviderId: string | null;
  supplierCost: number | null;
  supplierSku: string | null;
};

type CreateDropshipVariantAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  productId: string;
  sku?: string;
  price?: number;
  inventory?: number;
  options?: Record<string, string>;
  fulfillmentProviderId?: string | null;
  supplierCost?: number | null;
  supplierSku?: string | null;
};

export class DropshipVariantAggregate extends VariantAggregate<
  DropshipVariantState,
  DropshipVariantEvent
> {
  public readonly variantType = "dropship" as const;
  private inventory: number;
  public fulfillmentProviderId: string | null;
  public supplierCost: number | null;
  public supplierSku: string | null;

  constructor(params: DropshipVariantAggregateParams) {
    super(params);
    this.inventory = params.inventory;
    this.fulfillmentProviderId = params.fulfillmentProviderId;
    this.supplierCost = params.supplierCost;
    this.supplierSku = params.supplierSku;
  }

  protected createArchivedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantArchivedEvent(params);
  }

  protected createPublishedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantPublishedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantDetailsUpdatedEvent(params);
  }

  protected createPriceUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantPriceUpdatedEvent(params);
  }

  protected createSkuUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantSkuUpdatedEvent(params);
  }

  protected createImagesUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantImagesUpdatedEvent(params);
  }

  protected toState(): DropshipVariantState {
    return {
      ...this.baseState(),
      variantType: this.variantType,
      inventory: this.inventory,
      fulfillmentProviderId: this.fulfillmentProviderId,
      supplierCost: this.supplierCost,
      supplierSku: this.supplierSku,
    };
  }

  protected override validatePublish(): void {
    super.validatePublish();
    if (this.inventory < 0) {
      throw new Error("Cannot publish variant with negative inventory");
    }
  }

  updateInventory(inventory: number, userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();
    this.inventory = inventory;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const event = new DropshipVariantInventoryUpdatedEvent({
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
    const event = new DropshipVariantFulfillmentSettingsUpdatedEvent({
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
    inventory = 0,
    options = {},
    fulfillmentProviderId = null,
    supplierCost = null,
    supplierSku = null,
  }: CreateDropshipVariantAggregateParams) {
    const createdAt = new Date();
    const variantAggregate = new DropshipVariantAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      productId,
      sku,
      price,
      inventory,
      options,
      version: 0,
      status: "draft",
      publishedAt: null,
      images: ImageCollection.empty(),
      fulfillmentProviderId,
      supplierCost,
      supplierSku,
    });
    const priorState = {} as DropshipVariantState;
    const newState = variantAggregate.toState();
    const variantCreatedEvent = new DropshipVariantCreatedEvent({
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
    return new DropshipVariantAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      productId: payload.productId,
      sku: payload.sku,
      price: payload.price,
      inventory: payload.inventory,
      options: payload.options,
      version: snapshot.version,
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      images: payload.images
        ? ImageCollection.fromJSON(payload.images)
        : ImageCollection.empty(),
      fulfillmentProviderId: payload.fulfillmentProviderId ?? null,
      supplierCost: payload.supplierCost ?? null,
      supplierSku: payload.supplierSku ?? null,
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      variantType: this.variantType,
      inventory: this.inventory,
      fulfillmentProviderId: this.fulfillmentProviderId,
      supplierCost: this.supplierCost,
      supplierSku: this.supplierSku,
    };
  }
}
