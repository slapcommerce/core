import type { DomainEvent } from "../_base/domainEvent";
import {
    PaymentInitiatedEvent,
    PaymentSucceededEvent,
    PaymentFailedEvent,
    PaymentRefundedEvent,
    type PaymentState,
} from "./events";

type PaymentAggregateParams = {
    id: string;
    correlationId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    events: DomainEvent<string, Record<string, unknown>>[];
    orderId: string;
    amount: number;
    currency: string;
    provider: string;
    providerTransactionId: string | null;
    status: "pending" | "succeeded" | "failed" | "refunded";
    errorMessage: string | null;
};

type CreatePaymentAggregateParams = {
    id: string;
    correlationId: string;
    userId: string;
    orderId: string;
    amount: number;
    currency: string;
    provider: string;
};

export class PaymentAggregate {
    public id: string;
    public version: number = 0;
    public events: DomainEvent<string, Record<string, unknown>>[];
    public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    private correlationId: string;
    private createdAt: Date;
    private updatedAt: Date;
    private orderId: string;
    private amount: number;
    private currency: string;
    private provider: string;
    private providerTransactionId: string | null;
    private status: "pending" | "succeeded" | "failed" | "refunded";
    private errorMessage: string | null;

    constructor({
        id,
        correlationId,
        createdAt,
        updatedAt,
        version = 0,
        events,
        orderId,
        amount,
        currency,
        provider,
        providerTransactionId,
        status,
        errorMessage,
    }: PaymentAggregateParams) {
        this.id = id;
        this.correlationId = correlationId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.version = version;
        this.events = events;
        this.orderId = orderId;
        this.amount = amount;
        this.currency = currency;
        this.provider = provider;
        this.providerTransactionId = providerTransactionId;
        this.status = status;
        this.errorMessage = errorMessage;
    }

    static create({
        id,
        correlationId,
        userId,
        orderId,
        amount,
        currency,
        provider,
    }: CreatePaymentAggregateParams) {
        const createdAt = new Date();
        const paymentAggregate = new PaymentAggregate({
            id,
            correlationId,
            createdAt,
            updatedAt: createdAt,
            version: 0,
            events: [],
            orderId,
            amount,
            currency,
            provider,
            providerTransactionId: null,
            status: "pending",
            errorMessage: null,
        });

        const priorState = {} as PaymentState;
        const newState = paymentAggregate.toState();
        const paymentInitiatedEvent = new PaymentInitiatedEvent({
            occurredAt: createdAt,
            correlationId,
            aggregateId: id,
            version: 0,
            userId,
            priorState,
            newState,
        });
        paymentAggregate.uncommittedEvents.push(paymentInitiatedEvent);
        return paymentAggregate;
    }

    apply(event: DomainEvent<string, Record<string, unknown>>) {
        switch (event.eventName) {
            case "payment.initiated":
                const initiatedEvent = event as PaymentInitiatedEvent;
                const initiatedState = initiatedEvent.payload.newState;
                this.orderId = initiatedState.orderId;
                this.amount = initiatedState.amount;
                this.currency = initiatedState.currency;
                this.provider = initiatedState.provider;
                this.providerTransactionId = initiatedState.providerTransactionId;
                this.status = initiatedState.status;
                this.errorMessage = initiatedState.errorMessage;
                this.createdAt = initiatedState.createdAt;
                this.updatedAt = initiatedState.updatedAt;
                break;
            case "payment.succeeded":
                const succeededEvent = event as PaymentSucceededEvent;
                const succeededState = succeededEvent.payload.newState;
                this.providerTransactionId = succeededState.providerTransactionId;
                this.status = succeededState.status;
                this.updatedAt = succeededState.updatedAt;
                break;
            case "payment.failed":
                const failedEvent = event as PaymentFailedEvent;
                const failedState = failedEvent.payload.newState;
                this.status = failedState.status;
                this.errorMessage = failedState.errorMessage;
                this.updatedAt = failedState.updatedAt;
                break;
            case "payment.refunded":
                const refundedEvent = event as PaymentRefundedEvent;
                const refundedState = refundedEvent.payload.newState;
                this.status = refundedState.status;
                this.updatedAt = refundedState.updatedAt;
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventName}`);
        }
        this.version++;
        this.events.push(event);
    }

    private toState(): PaymentState {
        return {
            orderId: this.orderId,
            amount: this.amount,
            currency: this.currency,
            provider: this.provider,
            providerTransactionId: this.providerTransactionId,
            status: this.status,
            errorMessage: this.errorMessage,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    markAsSucceeded(providerTransactionId: string, userId: string) {
        if (this.status !== "pending") {
            throw new Error("Payment is not pending");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.providerTransactionId = providerTransactionId;
        this.status = "succeeded";
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new PaymentSucceededEvent({
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

    markAsFailed(errorMessage: string, userId: string) {
        if (this.status !== "pending") {
            throw new Error("Payment is not pending");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.status = "failed";
        this.errorMessage = errorMessage;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new PaymentFailedEvent({
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

    refund(userId: string) {
        if (this.status !== "succeeded") {
            throw new Error("Only succeeded payments can be refunded");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.status = "refunded";
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new PaymentRefundedEvent({
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
        return new PaymentAggregate({
            id: snapshot.aggregate_id,
            correlationId: snapshot.correlation_id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            version: snapshot.version,
            events: [],
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            provider: payload.provider,
            providerTransactionId: payload.providerTransactionId,
            status: payload.status,
            errorMessage: payload.errorMessage,
        });
    }

    toSnapshot() {
        return {
            id: this.id,
            orderId: this.orderId,
            amount: this.amount,
            currency: this.currency,
            provider: this.provider,
            providerTransactionId: this.providerTransactionId,
            status: this.status,
            errorMessage: this.errorMessage,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
