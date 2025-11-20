import type { DomainEvent } from "../_base/domainEvent";
import {
    CheckoutStartedEvent,
    CheckoutCustomerAttachedEvent,
    CheckoutShippingAddressUpdatedEvent,
    CheckoutBillingAddressUpdatedEvent,
    CheckoutShippingMethodUpdatedEvent,
    CheckoutCompletedEvent,
    type CheckoutState,
    type Address,
} from "./events";

type CheckoutAggregateParams = {
    id: string;
    correlationId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    events: DomainEvent<string, Record<string, unknown>>[];
    cartId: string;
    customerId: string | null;
    email: string;
    shippingAddress: Address | null;
    billingAddress: Address | null;
    shippingMethodId: string | null;
    status: "draft" | "completed" | "abandoned";
};

type CreateCheckoutAggregateParams = {
    id: string;
    correlationId: string;
    userId: string;
    cartId: string;
    email: string;
    customerId?: string | null;
};

export class CheckoutAggregate {
    public id: string;
    public version: number = 0;
    public events: DomainEvent<string, Record<string, unknown>>[];
    public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    private correlationId: string;
    private createdAt: Date;
    private updatedAt: Date;
    private cartId: string;
    private customerId: string | null;
    private email: string;
    private shippingAddress: Address | null;
    private billingAddress: Address | null;
    private shippingMethodId: string | null;
    private status: "draft" | "completed" | "abandoned";

    constructor({
        id,
        correlationId,
        createdAt,
        updatedAt,
        version = 0,
        events,
        cartId,
        customerId,
        email,
        shippingAddress,
        billingAddress,
        shippingMethodId,
        status,
    }: CheckoutAggregateParams) {
        this.id = id;
        this.correlationId = correlationId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.version = version;
        this.events = events;
        this.cartId = cartId;
        this.customerId = customerId;
        this.email = email;
        this.shippingAddress = shippingAddress;
        this.billingAddress = billingAddress;
        this.shippingMethodId = shippingMethodId;
        this.status = status;
    }

    static create({
        id,
        correlationId,
        userId,
        cartId,
        email,
        customerId = null,
    }: CreateCheckoutAggregateParams) {
        const createdAt = new Date();
        const checkoutAggregate = new CheckoutAggregate({
            id,
            correlationId,
            createdAt,
            updatedAt: createdAt,
            version: 0,
            events: [],
            cartId,
            customerId,
            email,
            shippingAddress: null,
            billingAddress: null,
            shippingMethodId: null,
            status: "draft",
        });

        const priorState = {} as CheckoutState;
        const newState = checkoutAggregate.toState();
        const checkoutStartedEvent = new CheckoutStartedEvent({
            occurredAt: createdAt,
            correlationId,
            aggregateId: id,
            version: 0,
            userId,
            priorState,
            newState,
        });
        checkoutAggregate.uncommittedEvents.push(checkoutStartedEvent);
        return checkoutAggregate;
    }

    apply(event: DomainEvent<string, Record<string, unknown>>) {
        switch (event.eventName) {
            case "checkout.started":
                const startedEvent = event as CheckoutStartedEvent;
                const startedState = startedEvent.payload.newState;
                this.cartId = startedState.cartId;
                this.customerId = startedState.customerId;
                this.email = startedState.email;
                this.shippingAddress = startedState.shippingAddress;
                this.billingAddress = startedState.billingAddress;
                this.shippingMethodId = startedState.shippingMethodId;
                this.status = startedState.status;
                this.createdAt = startedState.createdAt;
                this.updatedAt = startedState.updatedAt;
                break;
            case "checkout.customer_attached":
                const customerAttachedEvent = event as CheckoutCustomerAttachedEvent;
                const customerAttachedState = customerAttachedEvent.payload.newState;
                this.customerId = customerAttachedState.customerId;
                this.updatedAt = customerAttachedState.updatedAt;
                break;
            case "checkout.shipping_address_updated":
                const shippingAddressUpdatedEvent =
                    event as CheckoutShippingAddressUpdatedEvent;
                const shippingAddressUpdatedState =
                    shippingAddressUpdatedEvent.payload.newState;
                this.shippingAddress = shippingAddressUpdatedState.shippingAddress;
                this.updatedAt = shippingAddressUpdatedState.updatedAt;
                break;
            case "checkout.billing_address_updated":
                const billingAddressUpdatedEvent =
                    event as CheckoutBillingAddressUpdatedEvent;
                const billingAddressUpdatedState =
                    billingAddressUpdatedEvent.payload.newState;
                this.billingAddress = billingAddressUpdatedState.billingAddress;
                this.updatedAt = billingAddressUpdatedState.updatedAt;
                break;
            case "checkout.shipping_method_updated":
                const shippingMethodUpdatedEvent =
                    event as CheckoutShippingMethodUpdatedEvent;
                const shippingMethodUpdatedState =
                    shippingMethodUpdatedEvent.payload.newState;
                this.shippingMethodId = shippingMethodUpdatedState.shippingMethodId;
                this.updatedAt = shippingMethodUpdatedState.updatedAt;
                break;
            case "checkout.completed":
                const completedEvent = event as CheckoutCompletedEvent;
                const completedState = completedEvent.payload.newState;
                this.status = completedState.status;
                this.updatedAt = completedState.updatedAt;
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventName}`);
        }
        this.version++;
        this.events.push(event);
    }

    private toState(): CheckoutState {
        return {
            cartId: this.cartId,
            customerId: this.customerId,
            email: this.email,
            shippingAddress: this.shippingAddress,
            billingAddress: this.billingAddress,
            shippingMethodId: this.shippingMethodId,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    attachCustomer(customerId: string, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.customerId = customerId;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CheckoutCustomerAttachedEvent({
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

    updateShippingAddress(address: Address, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.shippingAddress = address;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CheckoutShippingAddressUpdatedEvent({
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

    updateBillingAddress(address: Address, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.billingAddress = address;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CheckoutBillingAddressUpdatedEvent({
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

    updateShippingMethod(shippingMethodId: string, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.shippingMethodId = shippingMethodId;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CheckoutShippingMethodUpdatedEvent({
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

    complete(userId: string) {
        if (this.status !== "draft") {
            throw new Error("Checkout is already completed or abandoned");
        }
        if (!this.shippingAddress) {
            throw new Error("Shipping address is required");
        }
        if (!this.billingAddress) {
            throw new Error("Billing address is required");
        }
        if (!this.shippingMethodId) {
            throw new Error("Shipping method is required");
        }

        const occurredAt = new Date();
        const priorState = this.toState();

        this.status = "completed";
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CheckoutCompletedEvent({
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
        return new CheckoutAggregate({
            id: snapshot.aggregate_id,
            correlationId: snapshot.correlation_id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            version: snapshot.version,
            events: [],
            cartId: payload.cartId,
            customerId: payload.customerId,
            email: payload.email,
            shippingAddress: payload.shippingAddress,
            billingAddress: payload.billingAddress,
            shippingMethodId: payload.shippingMethodId,
            status: payload.status,
        });
    }

    toSnapshot() {
        return {
            id: this.id,
            cartId: this.cartId,
            customerId: this.customerId,
            email: this.email,
            shippingAddress: this.shippingAddress,
            billingAddress: this.billingAddress,
            shippingMethodId: this.shippingMethodId,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
