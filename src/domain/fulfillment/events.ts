import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type FulfillmentItem = {
    variantId: string;
    quantity: number;
};

export type FulfillmentState = {
    id: string;
    orderId: string;
    items: FulfillmentItem[];
    trackingNumber: string | null;
    carrier: string | null;
    status: "pending" | "shipped" | "delivered" | "cancelled";
    shippedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type FulfillmentEventPayload = StateBasedPayload<FulfillmentState>;

export interface FulfillmentCreatedEventType
    extends DomainEvent<"fulfillment.created", FulfillmentEventPayload> { }
export interface FulfillmentShippedEventType
    extends DomainEvent<"fulfillment.shipped", FulfillmentEventPayload> { }
export interface FulfillmentDeliveredEventType
    extends DomainEvent<"fulfillment.delivered", FulfillmentEventPayload> { }
export interface FulfillmentCancelledEventType
    extends DomainEvent<"fulfillment.cancelled", FulfillmentEventPayload> { }

export type FulfillmentEvent =
    | FulfillmentCreatedEventType
    | FulfillmentShippedEventType
    | FulfillmentDeliveredEventType
    | FulfillmentCancelledEventType;

type FulfillmentEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: FulfillmentState;
    newState: FulfillmentState;
};

export class FulfillmentCreatedEvent implements FulfillmentCreatedEventType {
    occurredAt: Date;
    eventName = "fulfillment.created" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: FulfillmentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: FulfillmentEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

export class FulfillmentShippedEvent implements FulfillmentShippedEventType {
    occurredAt: Date;
    eventName = "fulfillment.shipped" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: FulfillmentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: FulfillmentEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

export class FulfillmentDeliveredEvent implements FulfillmentDeliveredEventType {
    occurredAt: Date;
    eventName = "fulfillment.delivered" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: FulfillmentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: FulfillmentEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

export class FulfillmentCancelledEvent implements FulfillmentCancelledEventType {
    occurredAt: Date;
    eventName = "fulfillment.cancelled" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: FulfillmentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: FulfillmentEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}
