import { describe, expect, test } from "bun:test";
import { CartAggregate } from "../../../src/domain/cart/aggregate";
import { uuidv7 } from "uuidv7";

describe("CartAggregate", () => {
    const userId = uuidv7();
    const cartId = uuidv7();
    const correlationId = uuidv7();

    test("should create a new cart", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        expect(cart.id).toBe(cartId);
        expect(cart.version).toBe(0);
        expect(cart.uncommittedEvents).toHaveLength(1);
        expect(cart.uncommittedEvents[0].eventName).toBe("cart.created");

        const state = cart.toSnapshot();
        expect(state.customerId).toBeNull();
        expect(state.items).toHaveLength(0);
        expect(state.expiresAt).toBeDefined();
    });

    test("should add item", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        cart.uncommittedEvents = [];

        const variantId = uuidv7();
        cart.addItem(variantId, 2, userId);

        expect(cart.version).toBe(1);
        expect(cart.uncommittedEvents).toHaveLength(1);
        expect(cart.uncommittedEvents[0].eventName).toBe("cart.item_added");

        const state = cart.toSnapshot();
        expect(state.items).toHaveLength(1);
        expect(state.items[0].variantId).toBe(variantId);
        expect(state.items[0].quantity).toBe(2);
    });

    test("should update item quantity", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        const variantId = uuidv7();
        cart.addItem(variantId, 1, userId);
        cart.uncommittedEvents = [];

        cart.updateItemQuantity(variantId, 5, userId);

        expect(cart.version).toBe(2);
        expect(cart.uncommittedEvents).toHaveLength(1);
        expect(cart.uncommittedEvents[0].eventName).toBe("cart.item_quantity_updated");

        const state = cart.toSnapshot();
        expect(state.items[0].quantity).toBe(5);
    });

    test("should remove item", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        const variantId = uuidv7();
        cart.addItem(variantId, 1, userId);
        cart.uncommittedEvents = [];

        cart.removeItem(variantId, userId);

        expect(cart.version).toBe(2);
        expect(cart.uncommittedEvents).toHaveLength(1);
        expect(cart.uncommittedEvents[0].eventName).toBe("cart.item_removed");

        const state = cart.toSnapshot();
        expect(state.items).toHaveLength(0);
    });

    test("should clear cart", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        cart.addItem(uuidv7(), 1, userId);
        cart.addItem(uuidv7(), 1, userId);
        cart.uncommittedEvents = [];

        cart.clear(userId);

        expect(cart.version).toBe(3);
        expect(cart.uncommittedEvents).toHaveLength(1);
        expect(cart.uncommittedEvents[0].eventName).toBe("cart.cleared");

        const state = cart.toSnapshot();
        expect(state.items).toHaveLength(0);
    });

    test("should attach customer", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        cart.uncommittedEvents = [];

        const customerId = uuidv7();
        cart.attachCustomer(customerId, userId);

        expect(cart.version).toBe(1);
        expect(cart.uncommittedEvents).toHaveLength(1);
        expect(cart.uncommittedEvents[0].eventName).toBe("cart.customer_attached");

        const state = cart.toSnapshot();
        expect(state.customerId).toBe(customerId);
    });

    test("should load from snapshot", () => {
        const cart = CartAggregate.create({
            id: cartId,
            correlationId,
            userId,
        });

        cart.addItem(uuidv7(), 1, userId);

        const snapshot = {
            aggregate_id: cart.id,
            correlation_id: correlationId,
            version: cart.version,
            payload: JSON.stringify(cart.toSnapshot()),
        };

        const loadedCart = CartAggregate.loadFromSnapshot(snapshot);

        expect(loadedCart.id).toBe(cart.id);
        expect(loadedCart.version).toBe(cart.version);
        expect(loadedCart.toSnapshot()).toEqual(cart.toSnapshot());
    });
});
