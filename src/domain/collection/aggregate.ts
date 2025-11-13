import type { DomainEvent } from "../_base/domainEvent";
import { CollectionCreatedEvent, CollectionArchivedEvent, CollectionMetadataUpdatedEvent, CollectionPublishedEvent, type CollectionState } from "./events";

type CollectionAggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  slug: string;
  version: number;
  events: DomainEvent<string, Record<string, unknown>>[];
  status: "draft" | "active" | "archived";
};

type CreateCollectionAggregateParams = {
  id: string;
  correlationId: string;
  name: string;
  description: string | null;
  slug: string;
};

export class CollectionAggregate {
  public id: string;
  public version: number = 0;
  public events: DomainEvent<string, Record<string, unknown>>[];
  public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
  private name: string;
  private description: string | null;
  slug: string;
  private status: "draft" | "active" | "archived";

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    name,
    description,
    slug,
    version = 0,
    events,
    status,
  }: CollectionAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.name = name;
    this.description = description;
    this.slug = slug;
    this.version = version;
    this.events = events;
    this.status = status;
  }

  static create({
    id,
    correlationId,
    name,
    description,
    slug,
  }: CreateCollectionAggregateParams) {
    const createdAt = new Date();
    const collectionAggregate = new CollectionAggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
      name,
      description,
      slug,
      version: 0,
      events: [],
      status: "draft",
    });
    const priorState = {} as CollectionState;
    const newState = collectionAggregate.toState();
    const collectionCreatedEvent = new CollectionCreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      priorState,
      newState,
    });
    collectionAggregate.uncommittedEvents.push(collectionCreatedEvent);
    return collectionAggregate;
  }

  apply(event: DomainEvent<string, Record<string, unknown>>) {
    switch (event.eventName) {
      case "collection.created":
        const createdEvent = event as CollectionCreatedEvent;
        const createdState = createdEvent.payload.newState;
        this.name = createdState.name;
        this.description = createdState.description;
        this.slug = createdState.slug;
        this.status = createdState.status;
        this.createdAt = createdState.createdAt;
        this.updatedAt = createdState.updatedAt;
        break;
      case "collection.archived":
        const archivedEvent = event as CollectionArchivedEvent;
        const archivedState = archivedEvent.payload.newState;
        this.status = archivedState.status;
        this.updatedAt = archivedState.updatedAt;
        break;
      case "collection.metadata_updated":
        const metadataUpdatedEvent = event as CollectionMetadataUpdatedEvent;
        const metadataUpdatedState = metadataUpdatedEvent.payload.newState;
        this.name = metadataUpdatedState.name;
        this.description = metadataUpdatedState.description;
        this.slug = metadataUpdatedState.slug;
        this.updatedAt = metadataUpdatedState.updatedAt;
        break;
      case "collection.published":
        const publishedEvent = event as CollectionPublishedEvent;
        const publishedState = publishedEvent.payload.newState;
        this.status = publishedState.status;
        this.updatedAt = publishedState.updatedAt;
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventName}`);
    }
    this.version++;
    this.events.push(event);
  }

  private toState(): CollectionState {
    return {
      name: this.name,
      description: this.description,
      slug: this.slug,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  publish() {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived collection");
    }
    if (this.status === "active") {
      throw new Error("Collection is already published");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "active";
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const publishedEvent = new CollectionPublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(publishedEvent);
    return this;
  }

  archive() {
    if (this.status === "archived") {
      throw new Error("Collection is already archived");
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "archived";
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const archivedEvent = new CollectionArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(archivedEvent);
    return this;
  }

  updateMetadata(name: string, description: string | null, slug: string) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.name = name;
    this.description = description;
    this.slug = slug;
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const metadataUpdatedEvent = new CollectionMetadataUpdatedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(metadataUpdatedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregate_id: string;
    correlation_id: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new CollectionAggregate({
      id: snapshot.aggregate_id,
      correlationId: snapshot.correlation_id,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      name: payload.name,
      description: payload.description,
      slug: payload.slug,
      version: snapshot.version,
      events: [],
      status: payload.status,
    });
  }

  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}

