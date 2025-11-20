import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

// Redefining Address here to keep aggregates decoupled, 
// but ideally this should be in a shared kernel/types file.
export type Address = {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone?: string;
};

export type CheckoutState = {
    cartId: string;
    customerId: string | null;
    email: string;
    shippingAddress: Address | null;
    billingAddress: Address | null;
    shippingMethodId: string | null;
    status: "draft" | "completed" | "abandoned";
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;
};

export type CheckoutEventPayload = StateBasedPayload<CheckoutState>;

type CheckoutStartedEventType = DomainEvent<
    "checkout.started",
    CheckoutEventPayload
>;

type CheckoutStartedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CheckoutState;
    newState: CheckoutState;
};

export class CheckoutStartedEvent implements CheckoutStartedEventType {
    occurredAt: Date;
    eventName = "checkout.started" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CheckoutEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CheckoutStartedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CheckoutCustomerAttachedEventType = DomainEvent<
    "checkout.customer_attached",
    CheckoutEventPayload
>;

type CheckoutCustomerAttachedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CheckoutState;
    newState: CheckoutState;
};

export class CheckoutCustomerAttachedEvent
    implements CheckoutCustomerAttachedEventType {
    occurredAt: Date;
    eventName = "checkout.customer_attached" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CheckoutEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CheckoutCustomerAttachedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CheckoutShippingAddressUpdatedEventType = DomainEvent<
    "checkout.shipping_address_updated",
    CheckoutEventPayload
>;

type CheckoutShippingAddressUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CheckoutState;
    newState: CheckoutState;
};

export class CheckoutShippingAddressUpdatedEvent
    implements CheckoutShippingAddressUpdatedEventType {
    occurredAt: Date;
    eventName = "checkout.shipping_address_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CheckoutEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CheckoutShippingAddressUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CheckoutBillingAddressUpdatedEventType = DomainEvent<
    "checkout.billing_address_updated",
    CheckoutEventPayload
>;

type CheckoutBillingAddressUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CheckoutState;
    newState: CheckoutState;
};

export class CheckoutBillingAddressUpdatedEvent
    implements CheckoutBillingAddressUpdatedEventType {
    occurredAt: Date;
    eventName = "checkout.billing_address_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CheckoutEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CheckoutBillingAddressUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CheckoutShippingMethodUpdatedEventType = DomainEvent<
    "checkout.shipping_method_updated",
    CheckoutEventPayload
>;

type CheckoutShippingMethodUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CheckoutState;
    newState: CheckoutState;
};

export class CheckoutShippingMethodUpdatedEvent
    implements CheckoutShippingMethodUpdatedEventType {
    occurredAt: Date;
    eventName = "checkout.shipping_method_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CheckoutEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CheckoutShippingMethodUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CheckoutCompletedEventType = DomainEvent<
    "checkout.completed",
    CheckoutEventPayload
>;

type CheckoutCompletedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CheckoutState;
    newState: CheckoutState;
};

export class CheckoutCompletedEvent implements CheckoutCompletedEventType {
    occurredAt: Date;
    eventName = "checkout.completed" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CheckoutEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CheckoutCompletedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}
