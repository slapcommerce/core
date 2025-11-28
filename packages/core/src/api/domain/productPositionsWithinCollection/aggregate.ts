import {
  ProductPositionsWithinCollectionCreatedEvent,
  ProductPositionsWithinCollectionReorderedEvent,
  ProductPositionsWithinCollectionProductAddedEvent,
  ProductPositionsWithinCollectionProductRemovedEvent,
  ProductPositionsWithinCollectionArchivedEvent,
  type ProductPositionsWithinCollectionState,
  type ProductPositionsWithinCollectionEvent,
} from "./events";

type ProductPositionsWithinCollectionAggregateParams = {
  id: string;
  collectionId: string;
  correlationId: string;
  productIds: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  events: ProductPositionsWithinCollectionEvent[];
};

type CreateProductPositionsWithinCollectionParams = {
  id: string;
  collectionId: string;
  correlationId: string;
  userId: string;
  productIds?: string[];
};

export class ProductPositionsWithinCollectionAggregate {
  public id: string;
  public collectionId: string;
  public version: number = 0;
  public events: ProductPositionsWithinCollectionEvent[];
  public uncommittedEvents: ProductPositionsWithinCollectionEvent[] = [];
  public correlationId: string;
  private productIds: string[];
  private createdAt: Date;
  private updatedAt: Date;

  constructor({
    id,
    collectionId,
    correlationId,
    productIds,
    createdAt,
    updatedAt,
    version,
    events,
  }: ProductPositionsWithinCollectionAggregateParams) {
    this.id = id;
    this.collectionId = collectionId;
    this.correlationId = correlationId;
    this.productIds = productIds;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.version = version;
    this.events = events;
  }

  static create({
    id,
    collectionId,
    correlationId,
    userId,
    productIds = [],
  }: CreateProductPositionsWithinCollectionParams) {
    const createdAt = new Date();
    const aggregate = new ProductPositionsWithinCollectionAggregate({
      id,
      collectionId,
      correlationId,
      productIds,
      createdAt,
      updatedAt: createdAt,
      version: 0,
      events: [],
    });

    const priorState = {} as ProductPositionsWithinCollectionState;
    const newState = aggregate.toState();
    const createdEvent = new ProductPositionsWithinCollectionCreatedEvent({
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

  private toState(): ProductPositionsWithinCollectionState {
    return {
      collectionId: this.collectionId,
      productIds: [...this.productIds],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  getProductIds(): string[] {
    return [...this.productIds];
  }

  getProductPosition(productId: string): number {
    return this.productIds.indexOf(productId);
  }

  reorder(newOrder: string[], userId: string) {
    // Validate that newOrder contains the same products
    const currentSet = new Set(this.productIds);
    const newSet = new Set(newOrder);

    if (currentSet.size !== newSet.size) {
      throw new Error(
        "New order must contain the same number of products as current order",
      );
    }

    for (const productId of newOrder) {
      if (!currentSet.has(productId)) {
        throw new Error(`Product ${productId} is not in this collection`);
      }
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    this.productIds = [...newOrder];
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const reorderedEvent = new ProductPositionsWithinCollectionReorderedEvent({
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

  addProduct(productId: string, userId: string, position?: number) {
    if (this.productIds.includes(productId)) {
      throw new Error(`Product ${productId} is already in this collection`);
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    if (position !== undefined && position >= 0 && position < this.productIds.length) {
      this.productIds.splice(position, 0, productId);
    } else {
      this.productIds.push(productId);
    }
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const addedEvent = new ProductPositionsWithinCollectionProductAddedEvent({
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

  removeProduct(productId: string, userId: string) {
    const index = this.productIds.indexOf(productId);
    if (index === -1) {
      throw new Error(`Product ${productId} is not in this collection`);
    }

    const occurredAt = new Date();
    const priorState = this.toState();

    this.productIds.splice(index, 1);
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const removedEvent = new ProductPositionsWithinCollectionProductRemovedEvent({
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

    this.productIds = [];
    this.updatedAt = occurredAt;
    this.version++;

    const newState = this.toState();
    const archivedEvent = new ProductPositionsWithinCollectionArchivedEvent({
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
    return new ProductPositionsWithinCollectionAggregate({
      id: snapshot.aggregateId,
      collectionId: payload.collectionId,
      correlationId: snapshot.correlationId,
      productIds: payload.productIds,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      version: snapshot.version,
      events: [],
    });
  }

  toSnapshot() {
    return {
      collectionId: this.collectionId,
      productIds: this.productIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
