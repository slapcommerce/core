import { describe, expect, test } from "bun:test";
import { CheckoutAggregate } from "../../../src/domain/checkout/aggregate";
import { uuidv7 } from "uuidv7";

describe("CheckoutAggregate", () => {
    const userId = uuidv7();
    const checkoutId = uuidv7();
    const correlationId = uuidv7();
    const cartId = uuidv7();

    test("should create a new checkout", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        expect(checkout.id).toBe(checkoutId);
        expect(checkout.version).toBe(0);
        expect(checkout.uncommittedEvents).toHaveLength(1);
        expect(checkout.uncommittedEvents[0].eventName).toBe("checkout.started");

        const state = checkout.toSnapshot();
        expect(state.cartId).toBe(cartId);
        expect(state.email).toBe("test@example.com");
        expect(state.status).toBe("draft");
    });

    test("should attach customer", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        checkout.uncommittedEvents = [];

        const customerId = uuidv7();
        checkout.attachCustomer(customerId, userId);

        expect(checkout.version).toBe(1);
        expect(checkout.uncommittedEvents).toHaveLength(1);
        expect(checkout.uncommittedEvents[0].eventName).toBe("checkout.customer_attached");

        const state = checkout.toSnapshot();
        expect(state.customerId).toBe(customerId);
    });

    test("should update shipping address", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        checkout.uncommittedEvents = [];

        const address = {
            firstName: "John",
            lastName: "Doe",
            address1: "123 Main St",
            city: "New York",
            province: "NY",
            postalCode: "10001",
            country: "US",
        };

        checkout.updateShippingAddress(address, userId);

        expect(checkout.version).toBe(1);
        expect(checkout.uncommittedEvents).toHaveLength(1);
        expect(checkout.uncommittedEvents[0].eventName).toBe("checkout.shipping_address_updated");

        const state = checkout.toSnapshot();
        expect(state.shippingAddress).toEqual(address);
    });

    test("should update billing address", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        checkout.uncommittedEvents = [];

        const address = {
            firstName: "John",
            lastName: "Doe",
            address1: "123 Main St",
            city: "New York",
            province: "NY",
            postalCode: "10001",
            country: "US",
        };

        checkout.updateBillingAddress(address, userId);

        expect(checkout.version).toBe(1);
        expect(checkout.uncommittedEvents).toHaveLength(1);
        expect(checkout.uncommittedEvents[0].eventName).toBe("checkout.billing_address_updated");

        const state = checkout.toSnapshot();
        expect(state.billingAddress).toEqual(address);
    });

    test("should update shipping method", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        checkout.uncommittedEvents = [];

        const shippingMethodId = uuidv7();
        checkout.updateShippingMethod(shippingMethodId, userId);

        expect(checkout.version).toBe(1);
        expect(checkout.uncommittedEvents).toHaveLength(1);
        expect(checkout.uncommittedEvents[0].eventName).toBe("checkout.shipping_method_updated");

        const state = checkout.toSnapshot();
        expect(state.shippingMethodId).toBe(shippingMethodId);
    });

    test("should complete checkout", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        const address = {
            firstName: "John",
            lastName: "Doe",
            address1: "123 Main St",
            city: "New York",
            province: "NY",
            postalCode: "10001",
            country: "US",
        };

        checkout.updateShippingAddress(address, userId);
        checkout.updateBillingAddress(address, userId);
        checkout.updateShippingMethod(uuidv7(), userId);
        checkout.uncommittedEvents = [];

        checkout.complete(userId);

        expect(checkout.version).toBe(4);
        expect(checkout.uncommittedEvents).toHaveLength(1);
        expect(checkout.uncommittedEvents[0].eventName).toBe("checkout.completed");

        const state = checkout.toSnapshot();
        expect(state.status).toBe("completed");
    });

    test("should fail to complete checkout if missing fields", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        expect(() => checkout.complete(userId)).toThrow();
    });

    test("should load from snapshot", () => {
        const checkout = CheckoutAggregate.create({
            id: checkoutId,
            correlationId,
            userId,
            cartId,
            email: "test@example.com",
        });

        const snapshot = {
            aggregate_id: checkout.id,
            correlation_id: correlationId,
            version: checkout.version,
            payload: JSON.stringify(checkout.toSnapshot()),
        };

        const loadedCheckout = CheckoutAggregate.loadFromSnapshot(snapshot);

        expect(loadedCheckout.id).toBe(checkout.id);
        expect(loadedCheckout.version).toBe(checkout.version);
        expect(loadedCheckout.toSnapshot()).toEqual(checkout.toSnapshot());
    });
});
