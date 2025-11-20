import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type CartItem = {
    variantId: string;
    quantity: number;
    addedAt: Date;
};

export type CartState = {
    customerId: string | null;
    items: CartItem[];
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;
};

export type CartEventPayload = StateBasedPayload<CartState>;

type CartCreatedEventType = DomainEvent<"cart.created", CartEventPayload>;

type CartCreatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CartState;
    newState: CartState;
};

export class CartCreatedEvent implements CartCreatedEventType {
    occurredAt: Date;
    eventName = "cart.created" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CartEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CartCreatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CartItemAddedEventType = DomainEvent<"cart.item_added", CartEventPayload>;

type CartItemAddedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CartState;
    newState: CartState;
};

export class CartItemAddedEvent implements CartItemAddedEventType {
    occurredAt: Date;
    eventName = "cart.item_added" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CartEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CartItemAddedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CartItemRemovedEventType = DomainEvent<
    "cart.item_removed",
    CartEventPayload
>;

type CartItemRemovedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CartState;
    newState: CartState;
};

export class CartItemRemovedEvent implements CartItemRemovedEventType {
    occurredAt: Date;
    eventName = "cart.item_removed" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CartEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CartItemRemovedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CartItemQuantityUpdatedEventType = DomainEvent<
    "cart.item_quantity_updated",
    CartEventPayload
>;

type CartItemQuantityUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CartState;
    newState: CartState;
};

export class CartItemQuantityUpdatedEvent
    implements CartItemQuantityUpdatedEventType {
    occurredAt: Date;
    eventName = "cart.item_quantity_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CartEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CartItemQuantityUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CartClearedEventType = DomainEvent<"cart.cleared", CartEventPayload>;

type CartClearedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CartState;
    newState: CartState;
};

export class CartClearedEvent implements CartClearedEventType {
    occurredAt: Date;
    eventName = "cart.cleared" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CartEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CartClearedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CartCustomerAttachedEventType = DomainEvent<
    "cart.customer_attached",
    CartEventPayload
>;

type CartCustomerAttachedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CartState;
    newState: CartState;
};

export class CartCustomerAttachedEvent
    implements CartCustomerAttachedEventType {
    occurredAt: Date;
    eventName = "cart.customer_attached" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CartEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CartCustomerAttachedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}
