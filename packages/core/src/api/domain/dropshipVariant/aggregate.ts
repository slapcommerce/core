import {
  VariantAggregate,
  type VariantEventParams,
  type VariantAggregateParams,
} from "../variant/aggregate";
import { SaleSchedule, DropSchedule } from "../_base/schedule";
import {
  DropshipVariantCreatedEvent,
  DropshipVariantArchivedEvent,
  DropshipVariantPublishedEvent,
  DropshipVariantDetailsUpdatedEvent,
  DropshipVariantPriceUpdatedEvent,
  DropshipVariantSaleUpdatedEvent,
  DropshipVariantSkuUpdatedEvent,
  DropshipVariantInventoryUpdatedEvent,
  DropshipVariantImagesUpdatedEvent,
  DropshipVariantFulfillmentSettingsUpdatedEvent,
  DropshipVariantDropScheduledEvent,
  DropshipVariantDroppedEvent,
  DropshipVariantScheduledDropUpdatedEvent,
  DropshipVariantScheduledDropCancelledEvent,
  DropshipVariantSaleScheduledEvent,
  DropshipVariantScheduledSaleStartedEvent,
  DropshipVariantScheduledSaleEndedEvent,
  DropshipVariantScheduledSaleUpdatedEvent,
  DropshipVariantScheduledSaleCancelledEvent,
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
  listPrice?: number;
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

  protected createSaleUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantSaleUpdatedEvent(params);
  }

  protected createSkuUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantSkuUpdatedEvent(params);
  }

  protected createImagesUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantImagesUpdatedEvent(params);
  }

  protected createDropScheduledEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantDropScheduledEvent(params);
  }

  protected createDroppedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantDroppedEvent(params);
  }

  protected createScheduledDropUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantScheduledDropUpdatedEvent(params);
  }

  protected createScheduledDropCancelledEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantScheduledDropCancelledEvent(params);
  }

  protected createSaleScheduledEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantSaleScheduledEvent(params);
  }

  protected createScheduledSaleStartedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantScheduledSaleStartedEvent(params);
  }

  protected createScheduledSaleEndedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantScheduledSaleEndedEvent(params);
  }

  protected createScheduledSaleUpdatedEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantScheduledSaleUpdatedEvent(params);
  }

  protected createScheduledSaleCancelledEvent(params: VariantEventParams<DropshipVariantState>) {
    return new DropshipVariantScheduledSaleCancelledEvent(params);
  }

  protected override validateCanScheduleSale(): void {
    super.validateCanScheduleSale();
    if (!this.fulfillmentProviderId) {
      throw new Error("Cannot schedule sale without a fulfillment provider");
    }
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
    listPrice = 0,
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
      listPrice,
      saleType: null,
      saleValue: null,
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
    const aggregate = new DropshipVariantAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      productId: payload.productId,
      sku: payload.sku,
      listPrice: payload.listPrice ?? payload.price ?? 0,
      saleType: payload.saleType ?? null,
      saleValue: payload.saleValue ?? null,
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

    // Restore sale schedule if present
    if (payload.saleSchedule) {
      aggregate.restoreSaleSchedule(SaleSchedule.fromState(payload.saleSchedule));
    }

    // Restore drop schedule if present
    if (payload.dropSchedule) {
      aggregate.restoreDropSchedule(DropSchedule.fromState(payload.dropSchedule));
    }

    return aggregate;
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
