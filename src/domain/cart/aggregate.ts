import type { DomainEvent } from "../_base/domainEvent";
import {
    CartCreatedEvent,
    CartItemAddedEvent,
    CartItemRemovedEvent,
    CartItemQuantityUpdatedEvent,
    CartClearedEvent,
    CartCustomerAttachedEvent,
    type CartState,
    type CartItem,
} from "./events";

type CartAggregateParams = {
    id: string;
    correlationId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    events: DomainEvent<string, Record<string, unknown>>[];
    customerId: string | null;
    items: CartItem[];
    expiresAt: Date;
};

type CreateCartAggregateParams = {
    id: string;
    correlationId: string;
    userId: string;
    customerId?: string | null;
    expiresAt?: Date;
};

export class CartAggregate {
    public id: string;
    public version: number = 0;
    public events: DomainEvent<string, Record<string, unknown>>[];
    public uncommittedEvents: DomainEvent<string, Record<string, unknown>>[] = [];
    private correlationId: string;
    private createdAt: Date;
    private updatedAt: Date;
    private customerId: string | null;
    private items: CartItem[];
    private expiresAt: Date;

    constructor({
        id,
        correlationId,
        createdAt,
        updatedAt,
        version = 0,
        events,
        customerId,
        items,
        expiresAt,
    }: CartAggregateParams) {
        this.id = id;
        this.correlationId = correlationId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.version = version;
        this.events = events;
        this.customerId = customerId;
        this.items = items;
        this.expiresAt = expiresAt;
    }

    static create({
        id,
        correlationId,
        userId,
        customerId = null,
        expiresAt,
    }: CreateCartAggregateParams) {
        const createdAt = new Date();
        // Default expiration to 30 days if not provided
        const defaultExpiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        const cartAggregate = new CartAggregate({
            id,
            correlationId,
            createdAt,
            updatedAt: createdAt,
            version: 0,
            events: [],
            customerId,
            items: [],
            expiresAt: expiresAt || defaultExpiresAt,
        });

        const priorState = {} as CartState;
        const newState = cartAggregate.toState();
        const cartCreatedEvent = new CartCreatedEvent({
            occurredAt: createdAt,
            correlationId,
            aggregateId: id,
            version: 0,
            userId,
            priorState,
            newState,
        });
        cartAggregate.uncommittedEvents.push(cartCreatedEvent);
        return cartAggregate;
    }

    apply(event: DomainEvent<string, Record<string, unknown>>) {
        switch (event.eventName) {
            case "cart.created":
                const createdEvent = event as CartCreatedEvent;
                const createdState = createdEvent.payload.newState;
                this.customerId = createdState.customerId;
                this.items = createdState.items;
                this.expiresAt = createdState.expiresAt;
                this.createdAt = createdState.createdAt;
                this.updatedAt = createdState.updatedAt;
                break;
            case "cart.item_added":
                const itemAddedEvent = event as CartItemAddedEvent;
                const itemAddedState = itemAddedEvent.payload.newState;
                this.items = itemAddedState.items;
                this.updatedAt = itemAddedState.updatedAt;
                break;
            case "cart.item_removed":
                const itemRemovedEvent = event as CartItemRemovedEvent;
                const itemRemovedState = itemRemovedEvent.payload.newState;
                this.items = itemRemovedState.items;
                this.updatedAt = itemRemovedState.updatedAt;
                break;
            case "cart.item_quantity_updated":
                const itemQuantityUpdatedEvent = event as CartItemQuantityUpdatedEvent;
                const itemQuantityUpdatedState = itemQuantityUpdatedEvent.payload.newState;
                this.items = itemQuantityUpdatedState.items;
                this.updatedAt = itemQuantityUpdatedState.updatedAt;
                break;
            case "cart.cleared":
                const clearedEvent = event as CartClearedEvent;
                const clearedState = clearedEvent.payload.newState;
                this.items = clearedState.items;
                this.updatedAt = clearedState.updatedAt;
                break;
            case "cart.customer_attached":
                const customerAttachedEvent = event as CartCustomerAttachedEvent;
                const customerAttachedState = customerAttachedEvent.payload.newState;
                this.customerId = customerAttachedState.customerId;
                this.updatedAt = customerAttachedState.updatedAt;
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventName}`);
        }
        this.version++;
        this.events.push(event);
    }

    private toState(): CartState {
        return {
            customerId: this.customerId,
            items: this.items,
            expiresAt: this.expiresAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    addItem(variantId: string, quantity: number, userId: string) {
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        const existingItem = this.items.find((item) => item.variantId === variantId);
        if (existingItem) {
            this.items = this.items.map((item) =>
                item.variantId === variantId
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            );
        } else {
            this.items = [
                ...this.items,
                { variantId, quantity, addedAt: occurredAt },
            ];
        }
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CartItemAddedEvent({
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

    removeItem(variantId: string, userId: string) {
        if (!this.items.some((item) => item.variantId === variantId)) {
            throw new Error("Item not found in cart");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.items = this.items.filter((item) => item.variantId !== variantId);
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CartItemRemovedEvent({
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

    updateItemQuantity(variantId: string, quantity: number, userId: string) {
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }
        if (!this.items.some((item) => item.variantId === variantId)) {
            throw new Error("Item not found in cart");
        }
        const occurredAt = new Date();
        const priorState = this.toState();

        this.items = this.items.map((item) =>
            item.variantId === variantId ? { ...item, quantity } : item
        );
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CartItemQuantityUpdatedEvent({
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

    clear(userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.items = [];
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CartClearedEvent({
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

    attachCustomer(customerId: string, userId: string) {
        const occurredAt = new Date();
        const priorState = this.toState();

        this.customerId = customerId;
        this.updatedAt = occurredAt;
        this.version++;

        const newState = this.toState();
        const event = new CartCustomerAttachedEvent({
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
        return new CartAggregate({
            id: snapshot.aggregate_id,
            correlationId: snapshot.correlation_id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            version: snapshot.version,
            events: [],
            customerId: payload.customerId,
            items: payload.items.map((item: any) => ({
                ...item,
                addedAt: new Date(item.addedAt),
            })),
            expiresAt: new Date(payload.expiresAt),
        });
    }

    toSnapshot() {
        return {
            id: this.id,
            customerId: this.customerId,
            items: this.items,
            expiresAt: this.expiresAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
