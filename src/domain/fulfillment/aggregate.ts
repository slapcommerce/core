import {
    FulfillmentCancelledEvent,
    FulfillmentCreatedEvent,
    FulfillmentDeliveredEvent,
    FulfillmentEvent,
    FulfillmentItem,
    FulfillmentShippedEvent,
    FulfillmentState,
} from "./events";

export class FulfillmentAggregate {
    public id: string;
    public version: number = 0;
    public events: FulfillmentEvent[] = [];
    public uncommittedEvents: FulfillmentEvent[] = [];

    private orderId: string;
    private items: FulfillmentItem[];
    private trackingNumber: string | null = null;
    private carrier: string | null = null;
    private status: "pending" | "shipped" | "delivered" | "cancelled" = "pending";
    private shippedAt: Date | null = null;
    private deliveredAt: Date | null = null;
    private createdAt: Date;
    private updatedAt: Date;

    constructor({
        id,
        orderId,
        items,
        trackingNumber = null,
        carrier = null,
        status = "pending",
        shippedAt = null,
        deliveredAt = null,
        createdAt,
        updatedAt,
    }: FulfillmentState) {
        this.id = id;
        this.orderId = orderId;
        this.items = items;
        this.trackingNumber = trackingNumber;
        this.carrier = carrier;
        this.status = status;
        this.shippedAt = shippedAt;
        this.deliveredAt = deliveredAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    static create({
        id,
        correlationId,
        userId,
        orderId,
        items,
    }: {
        id: string;
        correlationId: string;
        userId: string;
        orderId: string;
        items: FulfillmentItem[];
    }): FulfillmentAggregate {
        const now = new Date();
        const initialState: FulfillmentState = {
            id,
            orderId,
            items,
            trackingNumber: null,
            carrier: null,
            status: "pending",
            shippedAt: null,
            deliveredAt: null,
            createdAt: now,
            updatedAt: now,
        };

        const aggregate = new FulfillmentAggregate(initialState);

        const event = new FulfillmentCreatedEvent({
            occurredAt: now,
            aggregateId: id,
            correlationId,
            version: 0,
            userId,
            priorState: initialState, // For creation, prior and new are the same or prior is empty/null conceptually, but here we use initial
            newState: initialState,
        });

        aggregate.uncommittedEvents.push(event);

        return aggregate;
    }

    apply(event: FulfillmentEvent) {
        this.version = event.version + 1;
        this.events.push(event);

        const { newState } = event.payload;
        this.orderId = newState.orderId;
        this.items = newState.items;
        this.trackingNumber = newState.trackingNumber;
        this.carrier = newState.carrier;
        this.status = newState.status;
        this.shippedAt = newState.shippedAt;
        this.deliveredAt = newState.deliveredAt;
        this.createdAt = newState.createdAt;
        this.updatedAt = newState.updatedAt;
    }

    private toState(): FulfillmentState {
        return {
            id: this.id,
            orderId: this.orderId,
            items: this.items,
            trackingNumber: this.trackingNumber,
            carrier: this.carrier,
            status: this.status,
            shippedAt: this.shippedAt,
            deliveredAt: this.deliveredAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    markAsShipped(
        trackingNumber: string,
        carrier: string,
        userId: string,
        occurredAt: Date = new Date()
    ) {
        if (this.status !== "pending") {
            throw new Error("Fulfillment can only be shipped from pending state");
        }

        const priorState = this.toState();
        this.status = "shipped";
        this.trackingNumber = trackingNumber;
        this.carrier = carrier;
        this.shippedAt = occurredAt;
        this.updatedAt = occurredAt;
        this.version++;
        const newState = this.toState();

        const event = new FulfillmentShippedEvent({
            occurredAt,
            aggregateId: this.id,
            correlationId: this.id, // Using aggregate ID as correlation ID for simplicity if not provided
            version: this.version,
            userId,
            priorState,
            newState,
        });

        this.uncommittedEvents.push(event);
    }

    markAsDelivered(userId: string, occurredAt: Date = new Date()) {
        if (this.status !== "shipped") {
            throw new Error("Fulfillment can only be delivered from shipped state");
        }

        const priorState = this.toState();
        this.status = "delivered";
        this.deliveredAt = occurredAt;
        this.updatedAt = occurredAt;
        this.version++;
        const newState = this.toState();

        const event = new FulfillmentDeliveredEvent({
            occurredAt,
            aggregateId: this.id,
            correlationId: this.id,
            version: this.version,
            userId,
            priorState,
            newState,
        });

        this.uncommittedEvents.push(event);
    }

    cancel(userId: string, occurredAt: Date = new Date()) {
        if (this.status === "delivered" || this.status === "cancelled") {
            throw new Error("Cannot cancel a delivered or already cancelled fulfillment");
        }

        const priorState = this.toState();
        this.status = "cancelled";
        this.updatedAt = occurredAt;
        this.version++;
        const newState = this.toState();

        const event = new FulfillmentCancelledEvent({
            occurredAt,
            aggregateId: this.id,
            correlationId: this.id,
            version: this.version,
            userId,
            priorState,
            newState,
        });

        this.uncommittedEvents.push(event);
    }

    static loadFromSnapshot(snapshot: {
        aggregate_id: string;
        version: number;
        payload: string;
    }): FulfillmentAggregate {
        const state = JSON.parse(snapshot.payload) as FulfillmentState;
        // Ensure dates are parsed correctly
        state.createdAt = new Date(state.createdAt);
        state.updatedAt = new Date(state.updatedAt);
        if (state.shippedAt) state.shippedAt = new Date(state.shippedAt);
        if (state.deliveredAt) state.deliveredAt = new Date(state.deliveredAt);

        const aggregate = new FulfillmentAggregate(state);
        aggregate.version = snapshot.version;
        return aggregate;
    }

    toSnapshot() {
        return this.toState();
    }
}
