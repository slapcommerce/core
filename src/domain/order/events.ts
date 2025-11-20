import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";
import type { Address } from "../checkout/events";

export type OrderItem = {
    variantId: string;
    quantity: number;
    quantityFulfilled: number;
    price: number;
    tax: number;
    name: string;
    sku: string;
};

export type ShippingMethodSnapshot = {
    id: string;
    name: string;
    price: number;
};

export type OrderState = {
    checkoutId: string;
    customerId: string | null;
    orderNumber: string;
    items: OrderItem[];
    shippingAddress: Address;
    billingAddress: Address;
    shippingMethod: ShippingMethodSnapshot;
    subtotal: number;
    tax: number;
    shippingCost: number;
    total: number;
    paymentStatus: "pending" | "paid" | "failed" | "refunded";
    fulfillmentStatus: "unfulfilled" | "partially_fulfilled" | "fulfilled";
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;
};

export type OrderEventPayload = StateBasedPayload<OrderState>;

type OrderCreatedEventType = DomainEvent<"order.created", OrderEventPayload>;

type OrderCreatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: OrderState;
    newState: OrderState;
};

export class OrderCreatedEvent implements OrderCreatedEventType {
    occurredAt: Date;
    eventName = "order.created" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: OrderEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: OrderCreatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type OrderPaymentStatusUpdatedEventType = DomainEvent<
    "order.payment_status_updated",
    OrderEventPayload
>;

type OrderPaymentStatusUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: OrderState;
    newState: OrderState;
};

export class OrderPaymentStatusUpdatedEvent
    implements OrderPaymentStatusUpdatedEventType {
    occurredAt: Date;
    eventName = "order.payment_status_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: OrderEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: OrderPaymentStatusUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type OrderFulfillmentStatusUpdatedEventType = DomainEvent<
    "order.fulfillment_status_updated",
    OrderEventPayload
>;

type OrderFulfillmentStatusUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: OrderState;
    newState: OrderState;
};

export class OrderFulfillmentStatusUpdatedEvent
    implements OrderFulfillmentStatusUpdatedEventType {
    occurredAt: Date;
    eventName = "order.fulfillment_status_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: OrderEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: OrderFulfillmentStatusUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type OrderItemsFulfilledEventType = DomainEvent<
    "order.items_fulfilled",
    OrderEventPayload
>;

type OrderItemsFulfilledEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: OrderState;
    newState: OrderState;
};

export class OrderItemsFulfilledEvent implements OrderItemsFulfilledEventType {
    occurredAt: Date;
    eventName = "order.items_fulfilled" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: OrderEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: OrderItemsFulfilledEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}
