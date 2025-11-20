import type { DomainEvent } from "../_base/domainEvent";
import {
    CustomerCreatedEvent,
    CustomerProfileUpdatedEvent,
    CustomerAddressAddedEvent,
    CustomerAddressRemovedEvent,
    CustomerAddressUpdatedEvent,
    CustomerPaymentProviderIdUpdatedEvent,
    CustomerAuthUserIdUpdatedEvent,
    type CustomerState,
    type Address,
} from "./events";

type CustomerAggregateParams = {
    id: string;
    correlationId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    events: DomainEvent<string, Record<string, unknown>>[];
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    addresses: Address[];
    paymentProviderCustomerId: string | null;
};

type CreateCustomerAggregateParams = {
    id: string;
    correlationId: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
};

export class CustomerAggregate {
    public id: string;
    public version: number = 0;
    public events: DomainEvent<string, Record<string, unknown>>[];
    public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    private correlationId: string;
    private createdAt: Date;
    private updatedAt: Date;
    private email: string;
    private firstName: string;
    private lastName: string;
    private phone: string | null;
    private addresses: Address[];
    private paymentProviderCustomerId: string | null;
    private authUserId: string | null;

    constructor({
        id,
        correlationId,
        createdAt,
        updatedAt,
        version = 0,
        events,
        email,
        firstName,
        lastName,
        phone,
        addresses,
        paymentProviderCustomerId,
        authUserId,
    }: CustomerAggregateParams) {
        this.id = id;
        this.correlationId = correlationId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.version = version;
        this.events = events;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
        this.addresses = addresses;
        this.paymentProviderCustomerId = paymentProviderCustomerId;
        this.authUserId = authUserId;
    }

    static create({
        id,
        correlationId,
        userId,
        email,
        firstName,
        lastName,
        phone = null,
    }: CreateCustomerAggregateParams) {
        const createdAt = new Date();
        const customerAggregate = new CustomerAggregate({
            id,
            correlationId,
            createdAt,
            updatedAt: createdAt,
            version: 0,
            events: [],
            email,
            firstName,
            lastName,
            phone,
            addresses: [],
            paymentProviderCustomerId: null,
            authUserId: null,
        });

        const priorState = {} as CustomerState;
        const newState = customerAggregate.toState();
        const customerCreatedEvent = new CustomerCreatedEvent({
            occurredAt: createdAt,
            correlationId,
            aggregateId: id,
            version: 0,
            userId,
            priorState,
            newState,
        });
        customerAggregate.uncommittedEvents.push(customerCreatedEvent);
        return customerAggregate;
    }

    apply(event: DomainEvent<string, Record<string, unknown>>) {
        switch (event.eventName) {
            case "customer.created":
                const createdEvent = event as CustomerCreatedEvent;
                const createdState = createdEvent.payload.newState;
                this.email = createdState.email;
                this.firstName = createdState.firstName;
                this.lastName = createdState.lastName;
                this.phone = createdState.phone;
                this.addresses = createdState.addresses;
                this.paymentProviderCustomerId = createdState.paymentProviderCustomerId;
                this.createdAt = createdState.createdAt;
                this.updatedAt = createdState.updatedAt;
                break;
            case "customer.profile_updated":
                const profileUpdatedEvent = event as CustomerProfileUpdatedEvent;
                const profileUpdatedState = profileUpdatedEvent.payload.newState;
                this.email = profileUpdatedState.email;
                this.firstName = profileUpdatedState.firstName;
                this.lastName = profileUpdatedState.lastName;
                this.phone = profileUpdatedState.phone;
                this.updatedAt = profileUpdatedState.updatedAt;
                break;
            case "customer.address_added":
                const addressAddedEvent = event as CustomerAddressAddedEvent;
                const addressAddedState = addressAddedEvent.payload.newState;
                this.addresses = addressAddedState.addresses;
                this.updatedAt = addressAddedState.updatedAt;
                break;
            case "customer.address_removed":
                const addressRemovedEvent = event as CustomerAddressRemovedEvent;
                const addressRemovedState = addressRemovedEvent.payload.newState;
                this.addresses = addressRemovedState.addresses;
                this.updatedAt = addressRemovedState.updatedAt;
                break;
            case "customer.address_updated":
                const addressUpdatedEvent = event as CustomerAddressUpdatedEvent;
                const addressUpdatedState = addressUpdatedEvent.payload.newState;
                this.addresses = addressUpdatedState.addresses;
                this.updatedAt = addressUpdatedState.updatedAt;
                break;
            case "customer.payment_provider_id_updated":
                const paymentProviderIdUpdatedEvent =
                    event as CustomerPaymentProviderIdUpdatedEvent;
                const paymentProviderIdUpdatedState =
                    paymentProviderIdUpdatedEvent.payload.newState;
                this.paymentProviderCustomerId =
                    paymentProviderIdUpdatedState.paymentProviderCustomerId;
                this.updatedAt = paymentProviderIdUpdatedState.updatedAt;
                break;
            case "customer.auth_user_id_updated":
                const authUserIdUpdatedEvent = event as CustomerAuthUserIdUpdatedEvent;
                const authUserIdUpdatedState = authUserIdUpdatedEvent.payload.newState;
                this.authUserId = authUserIdUpdatedState.authUserId;
                this.updatedAt = authUserIdUpdatedState.updatedAt;
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventName}`);
        }
        this.version++;
        this.events.push(event);
    }

    private toState(): CustomerState {
        return {
            email: this.email,
            firstName: this.firstName,
            lastName: this.lastName,
            phone: this.phone,
            addresses: this.addresses,
            paymentProviderCustomerId: this.paymentProviderCustomerId,
            authUserId: this.authUserId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    updateProfile(
        email: string,
        firstName: string,
        lastName: string,
        phone: string | null,
        userId: string,
    ) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CustomerProfileUpdatedEvent({
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

    addAddress(address: Address, userId: string) {
        if (this.addresses.some((a) => a.id === address.id)) {
            throw new Error("Address with this ID already exists");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.addresses = [...this.addresses, address];
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CustomerAddressAddedEvent({
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

    removeAddress(addressId: string, userId: string) {
        if (!this.addresses.some((a) => a.id === addressId)) {
            throw new Error("Address not found");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.addresses = this.addresses.filter((a) => a.id !== addressId);
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CustomerAddressRemovedEvent({
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

    updateAddress(address: Address, userId: string) {
        if (!this.addresses.some((a) => a.id === address.id)) {
            throw new Error("Address not found");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.addresses = this.addresses.map((a) =>
            a.id === address.id ? address : a,
        );
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CustomerAddressUpdatedEvent({
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

    updatePaymentProviderId(paymentProviderCustomerId: string | null, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.paymentProviderCustomerId = paymentProviderCustomerId;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CustomerPaymentProviderIdUpdatedEvent({
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

    updateAuthUserId(authUserId: string | null, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.authUserId = authUserId;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CustomerAuthUserIdUpdatedEvent({
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
        return new CustomerAggregate({
            id: snapshot.aggregate_id,
            correlationId: snapshot.correlation_id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            version: snapshot.version,
            events: [],
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            addresses: payload.addresses,
            paymentProviderCustomerId: payload.paymentProviderCustomerId,
            authUserId: payload.authUserId,
        });
    }

    toSnapshot() {
        return {
            id: this.id,
            email: this.email,
            firstName: this.firstName,
            lastName: this.lastName,
            phone: this.phone,
            addresses: this.addresses,
            paymentProviderCustomerId: this.paymentProviderCustomerId,
            authUserId: this.authUserId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
