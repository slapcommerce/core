import type { DomainEvent } from "../_base/domainEvent";
import {
    OrderCreatedEvent,
    OrderPaymentStatusUpdatedEvent,
    OrderFulfillmentStatusUpdatedEvent,
    OrderItemsFulfilledEvent,
    type OrderState,
    type OrderItem,
    type ShippingMethodSnapshot,
} from "./events";
import type { Address } from "../checkout/events";

type OrderAggregateParams = {
    id: string;
    correlationId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    events: DomainEvent<string, Record<string, unknown>>[];
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
};

type CreateOrderAggregateParams = {
    id: string;
    correlationId: string;
    userId: string;
    checkoutId: string;
    customerId: string | null;
    orderNumber: string;
    items: OrderItem[];
    shippingAddress: Address;
    billingAddress: Address;
    shippingMethod: ShippingMethodSnapshot;
    subtotal: number;
    shippingCost: number;
    total: number;
};

export class OrderAggregate {
    public id: string;
    public version: number = 0;
    public events: DomainEvent<string, Record<string, unknown>>[];
    public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    private correlationId: string;
    private createdAt: Date;
    private updatedAt: Date;
    private checkoutId: string;
    private customerId: string | null;
    private orderNumber: string;
    private items: OrderItem[];
    private shippingAddress: Address;
    private billingAddress: Address;
    private shippingMethod: ShippingMethodSnapshot;
    private subtotal: number;
    private tax: number;
    private shippingCost: number;
    private total: number;
    private paymentStatus: "pending" | "paid" | "failed" | "refunded";
    private fulfillmentStatus: "unfulfilled" | "partially_fulfilled" | "fulfilled";

    constructor({
        id,
        correlationId,
        createdAt,
        updatedAt,
        version = 0,
        events,
        checkoutId,
        customerId,
        orderNumber,
        items,
        shippingAddress,
        billingAddress,
        shippingMethod,
        subtotal,
        tax,
        shippingCost,
        total,
        paymentStatus,
        fulfillmentStatus,
    }: OrderAggregateParams) {
        this.id = id;
        this.correlationId = correlationId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.version = version;
        this.events = events;
        this.checkoutId = checkoutId;
        this.customerId = customerId;
        this.orderNumber = orderNumber;
        this.items = items;
        this.shippingAddress = shippingAddress;
        this.billingAddress = billingAddress;
        this.shippingMethod = shippingMethod;
        this.subtotal = subtotal;
        this.tax = tax;
        this.shippingCost = shippingCost;
        this.total = total;
        this.paymentStatus = paymentStatus;
        this.fulfillmentStatus = fulfillmentStatus;
    }

    static create({
        id,
        correlationId,
        userId,
        checkoutId,
        customerId,
        orderNumber,
        items,
        shippingAddress,
        billingAddress,
        shippingMethod,
        subtotal,
        shippingCost,
        total,
    }: CreateOrderAggregateParams) {
        const createdAt = new Date();

        // Calculate total tax from items if not provided (or validate it)
        // For now, we assume the passed 'tax' argument is the total tax, 
        // but we ensure items have their tax set.
        // Actually, let's recalculate total tax from items to be safe and consistent with the requirement.
        const calculatedTax = items.reduce((sum, item) => sum + item.tax, 0);

        const orderAggregate = new OrderAggregate({
            id,
            correlationId,
            createdAt,
            updatedAt: createdAt,
            version: 0,
            events: [],
            checkoutId,
            customerId,
            orderNumber,
            items: items.map((item) => ({ ...item, quantityFulfilled: 0 })),
            shippingAddress,
            billingAddress,
            shippingMethod,
            subtotal,
            tax: calculatedTax,
            shippingCost,
            total,
            paymentStatus: "pending",
            fulfillmentStatus: "unfulfilled",
        });

        const priorState = {} as OrderState;
        const newState = orderAggregate.toState();
        const orderCreatedEvent = new OrderCreatedEvent({
            occurredAt: createdAt,
            correlationId,
            aggregateId: id,
            version: 0,
            userId,
            priorState,
            newState,
        });
        orderAggregate.uncommittedEvents.push(orderCreatedEvent);
        return orderAggregate;
    }

    apply(event: DomainEvent<string, Record<string, unknown>>) {
        switch (event.eventName) {
            case "order.created":
                const createdEvent = event as OrderCreatedEvent;
                const createdState = createdEvent.payload.newState;
                this.checkoutId = createdState.checkoutId;
                this.customerId = createdState.customerId;
                this.orderNumber = createdState.orderNumber;
                this.items = createdState.items;
                this.shippingAddress = createdState.shippingAddress;
                this.billingAddress = createdState.billingAddress;
                this.shippingMethod = createdState.shippingMethod;
                this.subtotal = createdState.subtotal;
                this.tax = createdState.tax;
                this.shippingCost = createdState.shippingCost;
                this.total = createdState.total;
                this.paymentStatus = createdState.paymentStatus;
                this.fulfillmentStatus = createdState.fulfillmentStatus;
                this.createdAt = createdState.createdAt;
                this.updatedAt = createdState.updatedAt;
                break;
            case "order.payment_status_updated":
                const paymentStatusUpdatedEvent = event as OrderPaymentStatusUpdatedEvent;
                const paymentStatusUpdatedState =
                    paymentStatusUpdatedEvent.payload.newState;
                this.paymentStatus = paymentStatusUpdatedState.paymentStatus;
                this.updatedAt = paymentStatusUpdatedState.updatedAt;
                break;
            case "order.fulfillment_status_updated":
                const fulfillmentStatusUpdatedEvent =
                    event as OrderFulfillmentStatusUpdatedEvent;
                const fulfillmentStatusUpdatedState =
                    fulfillmentStatusUpdatedEvent.payload.newState;
                this.fulfillmentStatus = fulfillmentStatusUpdatedState.fulfillmentStatus;
                this.updatedAt = fulfillmentStatusUpdatedState.updatedAt;
                break;
            case "order.items_fulfilled":
                const itemsFulfilledEvent = event as OrderItemsFulfilledEvent;
                const itemsFulfilledState = itemsFulfilledEvent.payload.newState;
                this.items = itemsFulfilledState.items;
                this.fulfillmentStatus = itemsFulfilledState.fulfillmentStatus;
                this.updatedAt = itemsFulfilledState.updatedAt;
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventName}`);
        }
        this.version++;
        this.events.push(event);
    }

    private toState(): OrderState {
        return {
            checkoutId: this.checkoutId,
            customerId: this.customerId,
            orderNumber: this.orderNumber,
            items: this.items,
            shippingAddress: this.shippingAddress,
            billingAddress: this.billingAddress,
            shippingMethod: this.shippingMethod,
            subtotal: this.subtotal,
            tax: this.tax,
            shippingCost: this.shippingCost,
            total: this.total,
            paymentStatus: this.paymentStatus,
            fulfillmentStatus: this.fulfillmentStatus,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    updatePaymentStatus(
        status: "pending" | "paid" | "failed" | "refunded",
        userId: string,
    ) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.paymentStatus = status;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new OrderPaymentStatusUpdatedEvent({
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

    updateFulfillmentStatus(
        status: "unfulfilled" | "partially_fulfilled" | "fulfilled",
        userId: string,
    ) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.fulfillmentStatus = status;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new OrderFulfillmentStatusUpdatedEvent({
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

    fulfillItems(
        itemsToFulfill: { variantId: string; quantity: number }[],
        userId: string,
    ) {
        const occurredAt = new Date();
        const priorState = this.toState();

        // Update item quantities
        for (const fulfillItem of itemsToFulfill) {
            const orderItem = this.items.find(
                (i) => i.variantId === fulfillItem.variantId,
            );
            if (!orderItem) {
                throw new Error(
                    `Item with variantId ${fulfillItem.variantId} not found in order`,
                );
            }

            if (
                orderItem.quantityFulfilled + fulfillItem.quantity >
                orderItem.quantity
            ) {
                throw new Error(
                    `Cannot fulfill more than ordered quantity for variant ${fulfillItem.variantId}`,
                );
            }

            orderItem.quantityFulfilled += fulfillItem.quantity;
        }

        // Recalculate fulfillment status
        const allFulfilled = this.items.every(
            (i) => i.quantityFulfilled === i.quantity,
        );
        const someFulfilled = this.items.some((i) => i.quantityFulfilled > 0);

        if (allFulfilled) {
            this.fulfillmentStatus = "fulfilled";
        } else if (someFulfilled) {
            this.fulfillmentStatus = "partially_fulfilled";
        } else {
            this.fulfillmentStatus = "unfulfilled";
        }

        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new OrderItemsFulfilledEvent({
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

    static loadFromSnapshot(snapshot: {
        aggregate_id: string;
        correlation_id: string;
        version: number;
        payload: string;
    }) {
        const payload = JSON.parse(snapshot.payload);
        return new OrderAggregate({
            id: snapshot.aggregate_id,
            correlationId: snapshot.correlation_id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            version: snapshot.version,
            events: [],
            checkoutId: payload.checkoutId,
            customerId: payload.customerId,
            orderNumber: payload.orderNumber,
            items: payload.items,
            shippingAddress: payload.shippingAddress,
            billingAddress: payload.billingAddress,
            shippingMethod: payload.shippingMethod,
            subtotal: payload.subtotal,
            tax: payload.tax,
            shippingCost: payload.shippingCost,
            total: payload.total,
            paymentStatus: payload.paymentStatus,
            fulfillmentStatus: payload.fulfillmentStatus,
        });
    }

    toSnapshot() {
        return {
            id: this.id,
            checkoutId: this.checkoutId,
            customerId: this.customerId,
            orderNumber: this.orderNumber,
            items: this.items,
            shippingAddress: this.shippingAddress,
            billingAddress: this.billingAddress,
            shippingMethod: this.shippingMethod,
            subtotal: this.subtotal,
            tax: this.tax,
            shippingCost: this.shippingCost,
            total: this.total,
            paymentStatus: this.paymentStatus,
            fulfillmentStatus: this.fulfillmentStatus,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
