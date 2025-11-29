import { SlugReservedEvent, SlugRedirectedEvent, SlugReleasedEvent, type SlugState, type SlugEvent, type SlugEntityType } from "./slugEvents";

type SlugAggregateParams = {
  id: string; // The slug itself
  correlationId: string;
  version: number;
  events: SlugEvent[];
  slug: string;
  entityId: string | null;
  entityType: SlugEntityType | null;
  status: "active" | "redirect";
};

type CreateSlugAggregateParams = {
  slug: string;
  correlationId: string;
};

export class SlugAggregate {
  public id: string; // The slug itself
  public version: number = 0;
  public events: SlugEvent[];
  public uncommittedEvents: SlugEvent[] = [];
  private correlationId: string;
  private slug: string;
  private entityId: string | null;
  private entityType: SlugEntityType | null;
  private status: "active" | "redirect";

  constructor({
    id,
    correlationId,
    version = 0,
    events,
    slug,
    entityId,
    entityType,
    status,
  }: SlugAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.events = events;
    this.slug = slug;
    this.entityId = entityId;
    this.entityType = entityType;
    this.status = status;
  }

  static create({ slug, correlationId }: CreateSlugAggregateParams) {
    const slugAggregate = new SlugAggregate({
      id: slug,
      correlationId,
      version: 0,
      events: [],
      slug,
      entityId: null,
      entityType: null,
      status: "active",
    });
    return slugAggregate;
  }

  isSlugAvailable(): boolean {
    return this.entityId === null;
  }

  private toState(): SlugState {
    return {
      slug: this.slug,
      entityId: this.entityId,
      entityType: this.entityType,
      status: this.status,
    };
  }

  reserveSlug(entityId: string, entityType: SlugEntityType, userId: string) {
    if (!this.isSlugAvailable()) {
      throw new Error(`Slug "${this.slug}" is already in use`);
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.entityId = entityId;
    this.entityType = entityType;
    this.status = "active";
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const reservedEvent = new SlugReservedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(reservedEvent);
    return this;
  }

  releaseSlug(userId: string) {
    if (this.entityId === null) {
      // Already released, silently ignore (idempotent)
      return this;
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.entityId = null;
    this.entityType = null;
    this.status = "active";
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const releasedEvent = new SlugReleasedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(releasedEvent);
    return this;
  }

  markAsRedirect(redirectedToSlug: string, userId: string) {
    if (this.status === "redirect") {
      // Already redirected, silently ignore (idempotent)
      return this;
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.status = "redirect";
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const redirectedEvent = new SlugRedirectedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(redirectedEvent);
    return this;
  }

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new SlugAggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      version: snapshot.version,
      events: [],
      slug: payload.slug,
      entityId: payload.entityId ?? payload.productId ?? null, // Backwards compatibility
      entityType: payload.entityType ?? (payload.productId ? "product" : null), // Backwards compatibility
      status: payload.status ?? "active",
    });
  }

  toSnapshot() {
    return {
      slug: this.slug,
      entityId: this.entityId,
      entityType: this.entityType,
      status: this.status,
    };
  }
}

