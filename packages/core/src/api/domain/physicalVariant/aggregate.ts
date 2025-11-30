import {
  VariantAggregate,
  type VariantEventParams,
  type VariantAggregateParams,
} from "../variant/VariantAggregate";
import {
  PhysicalVariantCreatedEvent,
  PhysicalVariantArchivedEvent,
  PhysicalVariantPublishedEvent,
  PhysicalVariantDetailsUpdatedEvent,
  PhysicalVariantPriceUpdatedEvent,
  PhysicalVariantSkuUpdatedEvent,
  PhysicalVariantInventoryUpdatedEvent,
  PhysicalVariantImagesUpdatedEvent,
  type PhysicalVariantState,
  type PhysicalVariantEvent,
} from "./events";
import { ImageCollection } from "../_base/imageCollection";

type PhysicalVariantAggregateParams = VariantAggregateParams & {
  inventory: number;
};

type CreatePhysicalVariantAggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
  productId: string;
  sku?: string;
  price?: number;
  inventory?: number;
  options?: Record<string, string>;
};

export class PhysicalVariantAggregate extends VariantAggregate<
  PhysicalVariantState,
  PhysicalVariantEvent
> {
  public readonly variantType = "physical" as const;
  private inventory: number;

  constructor(params: PhysicalVariantAggregateParams) {
    super(params);
    this.inventory = params.inventory;
  }

  protected createArchivedEvent(params: VariantEventParams<PhysicalVariantState>) {
    return new PhysicalVariantArchivedEvent(params);
  }

  protected createPublishedEvent(params: VariantEventParams<PhysicalVariantState>) {
    return new PhysicalVariantPublishedEvent(params);
  }

  protected createDetailsUpdatedEvent(params: VariantEventParams<PhysicalVariantState>) {
    return new PhysicalVariantDetailsUpdatedEvent(params);
  }

  protected createPriceUpdatedEvent(params: VariantEventParams<PhysicalVariantState>) {
    return new PhysicalVariantPriceUpdatedEvent(params);
  }

  protected createSkuUpdatedEvent(params: VariantEventParams<PhysicalVariantState>) {
    return new PhysicalVariantSkuUpdatedEvent(params);
  }

  protected createImagesUpdatedEvent(params: VariantEventParams<PhysicalVariantState>) {
    return new PhysicalVariantImagesUpdatedEvent(params);
  }

  protected toState(): PhysicalVariantState {
    return {
      ...this.baseState(),
      variantType: this.variantType,
      inventory: this.inventory,
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
    const event = new PhysicalVariantInventoryUpdatedEvent({
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
  }: CreatePhysicalVariantAggregateParams) {
    const createdAt = new Date();
    const variantAggregate = new PhysicalVariantAggregate({
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
    });
    const priorState = {} as PhysicalVariantState;
    const newState = variantAggregate.toState();
    const variantCreatedEvent = new PhysicalVariantCreatedEvent({
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
    return new PhysicalVariantAggregate({
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
    });
  }

  override toSnapshot() {
    return {
      ...super.toSnapshot(),
      variantType: this.variantType,
      inventory: this.inventory,
    };
  }
}
