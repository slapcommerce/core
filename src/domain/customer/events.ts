import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type Address = {
    id: string;
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province: string; // State/Province code
    postalCode: string;
    country: string; // ISO 2-letter code
    phone?: string;
};

export type CustomerState = {
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    addresses: Address[];
    paymentProviderCustomerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;
};

export type CustomerEventPayload = StateBasedPayload<CustomerState>;

type CustomerCreatedEventType = DomainEvent<
    "customer.created",
    CustomerEventPayload
>;

type CustomerCreatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string; // Could be system or admin user
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerCreatedEvent implements CustomerCreatedEventType {
    occurredAt: Date;
    eventName = "customer.created" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerCreatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CustomerProfileUpdatedEventType = DomainEvent<
    "customer.profile_updated",
    CustomerEventPayload
>;

type CustomerProfileUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerProfileUpdatedEvent
    implements CustomerProfileUpdatedEventType {
    occurredAt: Date;
    eventName = "customer.profile_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerProfileUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CustomerAddressAddedEventType = DomainEvent<
    "customer.address_added",
    CustomerEventPayload
>;

type CustomerAddressAddedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerAddressAddedEvent implements CustomerAddressAddedEventType {
    occurredAt: Date;
    eventName = "customer.address_added" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerAddressAddedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CustomerAddressRemovedEventType = DomainEvent<
    "customer.address_removed",
    CustomerEventPayload
>;

type CustomerAddressRemovedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerAddressRemovedEvent
    implements CustomerAddressRemovedEventType {
    occurredAt: Date;
    eventName = "customer.address_removed" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerAddressRemovedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CustomerAddressUpdatedEventType = DomainEvent<
    "customer.address_updated",
    CustomerEventPayload
>;

type CustomerAddressUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerAddressUpdatedEvent
    implements CustomerAddressUpdatedEventType {
    occurredAt: Date;
    eventName = "customer.address_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerAddressUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CustomerPaymentProviderIdUpdatedEventType = DomainEvent<
    "customer.payment_provider_id_updated",
    CustomerEventPayload
>;

type CustomerPaymentProviderIdUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerPaymentProviderIdUpdatedEvent
    implements CustomerPaymentProviderIdUpdatedEventType {
    occurredAt: Date;
    eventName = "customer.payment_provider_id_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerPaymentProviderIdUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type CustomerAuthUserIdUpdatedEventType = DomainEvent<
    "customer.auth_user_id_updated",
    CustomerEventPayload
>;

type CustomerAuthUserIdUpdatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: CustomerState;
    newState: CustomerState;
};

export class CustomerAuthUserIdUpdatedEvent
    implements CustomerAuthUserIdUpdatedEventType {
    occurredAt: Date;
    eventName = "customer.auth_user_id_updated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: CustomerEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: CustomerAuthUserIdUpdatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}
