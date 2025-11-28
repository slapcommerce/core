import {
  VariantPositionsWithinProductCreatedEvent,
  VariantPositionsWithinProductReorderedEvent,
  VariantPositionsWithinProductVariantAddedEvent,
  VariantPositionsWithinProductVariantRemovedEvent,
  VariantPositionsWithinProductArchivedEvent,
  type VariantPositionsWithinProductState,
  type VariantPositionsWithinProductEvent,
} from "./events";

type VariantPositionsWithinProductAggregateParams = {
  id: string;
  productId: string;
  correlationId: string;
  variantIds: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  events: VariantPositionsWithinProductEvent[];
};

type CreateVariantPositionsWithinProductParams = {
  id: string;
  productId: string;
  correlationId: string;
  userId: string;
  variantIds?: string[];
};

export class VariantPositionsWithinProductAggregate {
  public id: string;
  public productId: string;
  public version: number = 0;
  public events: VariantPositionsWithinProductEvent[];
  public uncommittedEvents: VariantPositionsWithinProductEvent[] = [];
  public correlationId: string;
  private variantIds: string[];
  private createdAt: Date;
  private updatedAt: Date;

  constructor({
    id,
    productId,
    correlationId,
    variantIds,
    createdAt,
    updatedAt,
    version,
    events,
  }: VariantPositionsWithinProductAggregateParams) {
    this.id = id;
    this.productId = productId;
    this.correlationId = correlationId;
    this.variantIds = variantIds;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.version = version;
    this.events = events;
  }

  static create({
    id,
    productId,
    correlationId,
    userId,
    variantIds = [],
  }: CreateVariantPositionsWithinProductParams) {
    const createdAt = new Date();
    const aggregate = new VariantPositionsWithinProductAggregate({
      id,
      productId,
      correlationId,
      variantIds,
      createdAt,
      updatedAt: createdAt,
      version: 0,
      events: [],
    });

    const priorState = {} as VariantPositionsWithinProductState;
    const newState = aggregate.toState();
    const createdEvent = new VariantPositionsWithinProductCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    aggregate.uncommittedEvents.push(createdEvent);
    return aggregate;
  }

  private toState(): VariantPositionsWithinProductState {
    return {
      productId: this.productId,
      variantIds: [...this.variantIds],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  getVariantIds(): string[] {
    return [...this.variantIds];
  }

  getVariantPosition(variantId: string): number {
    return this.variantIds.indexOf(variantId);
  }

  reorder(newOrder: string[], userId: string) {
    // Validate that newOrder contains the same variants
    const currentSet = new Set(this.variantIds);
    const newSet = new Set(newOrder);

    if (currentSet.size !== newSet.size) {
      throw new Error(
        "New order must contain the same number of variants as current order",
      );
    }

    for (const variantId of newOrder) {
      if (!currentSet.has(variantId)) {
        throw new Error(`Variant ${variantId} is not in this product`);
      }
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    this.variantIds = [...newOrder];
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const reorderedEvent = new VariantPositionsWithinProductReorderedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(reorderedEvent);
    return this;
  }

  addVariant(variantId: string, userId: string, position?: number) {
    if (this.variantIds.includes(variantId)) {
      throw new Error(`Variant ${variantId} is already in this product`);
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    if (position !== undefined && position >= 0 && position < this.variantIds.length) {
      this.variantIds.splice(position, 0, variantId);
    } else {
      this.variantIds.push(variantId);
    }
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const addedEvent = new VariantPositionsWithinProductVariantAddedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(addedEvent);
    return this;
  }

  removeVariant(variantId: string, userId: string) {
    const index = this.variantIds.indexOf(variantId);
    if (index === -1) {
      throw new Error(`Variant ${variantId} is not in this product`);
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    this.variantIds.splice(index, 1);
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const removedEvent = new VariantPositionsWithinProductVariantRemovedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(removedEvent);
    return this;
  }

  archive(userId: string) {
    const occurredAt = new Date();
    const priorState = this.toState();

    this.variantIds = [];
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const archivedEvent = new VariantPositionsWithinProductArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(archivedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new VariantPositionsWithinProductAggregate({
      id: snapshot.aggregateId,
      productId: payload.productId,
      correlationId: snapshot.correlationId,
      variantIds: payload.variantIds,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      version: snapshot.version,
      events: [],
    });
  }

  toSnapshot() {
    return {
      productId: this.productId,
      variantIds: this.variantIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
