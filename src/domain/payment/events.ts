import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type PaymentState = {
    orderId: string;
    amount: number;
    currency: string;
    provider: string;
    providerTransactionId: string | null;
    status: "pending" | "succeeded" | "failed" | "refunded";
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;
};

export type PaymentEventPayload = StateBasedPayload<PaymentState>;

type PaymentInitiatedEventType = DomainEvent<
    "payment.initiated",
    PaymentEventPayload
>;

type PaymentInitiatedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: PaymentState;
    newState: PaymentState;
};

export class PaymentInitiatedEvent implements PaymentInitiatedEventType {
    occurredAt: Date;
    eventName = "payment.initiated" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: PaymentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: PaymentInitiatedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type PaymentSucceededEventType = DomainEvent<
    "payment.succeeded",
    PaymentEventPayload
>;

type PaymentSucceededEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: PaymentState;
    newState: PaymentState;
};

export class PaymentSucceededEvent implements PaymentSucceededEventType {
    occurredAt: Date;
    eventName = "payment.succeeded" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: PaymentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: PaymentSucceededEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type PaymentFailedEventType = DomainEvent<
    "payment.failed",
    PaymentEventPayload
>;

type PaymentFailedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: PaymentState;
    newState: PaymentState;
};

export class PaymentFailedEvent implements PaymentFailedEventType {
    occurredAt: Date;
    eventName = "payment.failed" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: PaymentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: PaymentFailedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}

type PaymentRefundedEventType = DomainEvent<
    "payment.refunded",
    PaymentEventPayload
>;

type PaymentRefundedEventParams = {
    occurredAt: Date;
    aggregateId: string;
    correlationId: string;
    version: number;
    userId: string;
    priorState: PaymentState;
    newState: PaymentState;
};

export class PaymentRefundedEvent implements PaymentRefundedEventType {
    occurredAt: Date;
    eventName = "payment.refunded" as const;
    correlationId: string;
    aggregateId: string;
    version: number;
    userId: string;
    payload: PaymentEventPayload;

    constructor({
        occurredAt,
        aggregateId,
        correlationId,
        version,
        userId,
        priorState,
        newState,
    }: PaymentRefundedEventParams) {
        this.occurredAt = occurredAt;
        this.correlationId = correlationId;
        this.aggregateId = aggregateId;
        this.version = version;
        this.userId = userId;
        this.payload = { priorState, newState };
    }
}
