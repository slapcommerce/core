import { SlugReservedEvent, SlugRedirectedEvent, SlugReleasedEvent, type SlugState, type SlugEvent } from "./slugEvents";

type SlugAggregateParams = {
  id: string; // The slug itself
  correlationId: string;
  version: number;
  events: SlugEvent[];
  slug: string;
  productId: string | null;
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
  private productId: string | null;
  private status: "active" | "redirect";

  constructor({
    id,
    correlationId,
    version = 0,
    events,
    slug,
    productId,
    status,
  }: SlugAggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.version = version;
    this.events = events;
    this.slug = slug;
    this.productId = productId;
    this.status = status;
  }

  static create({ slug, correlationId }: CreateSlugAggregateParams) {
    const slugAggregate = new SlugAggregate({
      id: slug,
      correlationId,
      version: 0,
      events: [],
      slug,
      productId: null,
      status: "active",
    });
    return slugAggregate;
  }

  isSlugAvailable(): boolean {
    return this.productId === null;
  }

  private toState(): SlugState {
    return {
      slug: this.slug,
      productId: this.productId,
      status: this.status,
    };
  }

  reserveSlug(productId: string, userId: string) {
    if (!this.isSlugAvailable()) {
      throw new Error(`Slug "${this.slug}" is already in use`);
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.productId = productId;
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
    if (this.productId === null) {
      // Already released, silently ignore (idempotent)
      return this;
    }
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
    this.productId = null;
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
    aggregate_id: string;
    correlation_id: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new SlugAggregate({
      id: snapshot.aggregate_id,
      correlationId: snapshot.correlation_id,
      version: snapshot.version,
      events: [],
      slug: payload.slug,
      productId: payload.productId ?? null,
      status: payload.status ?? "active",
    });
  }

  toSnapshot() {
    return {
      slug: this.slug,
      productId: this.productId,
      status: this.status,
    };
  }
}

