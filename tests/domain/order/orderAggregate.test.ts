import { describe, expect, test } from "bun:test";
import { OrderAggregate } from "../../../src/domain/order/aggregate";
import { uuidv7 } from "uuidv7";

describe("OrderAggregate", () => {
    const userId = uuidv7();
    const orderId = uuidv7();
    const correlationId = uuidv7();
    const checkoutId = uuidv7();
    const variantId1 = uuidv7();
    const variantId2 = uuidv7();

    const mockItems = [
        {
            variantId: variantId1,
            quantity: 2,
            price: 1000,
            tax: 100,
            name: "Product 1",
            sku: "SKU1",
            quantityFulfilled: 0,
        },
        {
            variantId: variantId2,
            quantity: 1,
            price: 2000,
            tax: 200,
            name: "Product 2",
            sku: "SKU2",
            quantityFulfilled: 0,
        },
    ];

    const mockAddress = {
        firstName: "John",
        lastName: "Doe",
        address1: "123 Main St",
        city: "New York",
        province: "NY",
        postalCode: "10001",
        countryCode: "US",
        phone: "555-1234",
    };

    const mockShippingMethod = {
        id: "standard",
        name: "Standard Shipping",
        price: 500,
    };

    test("should create a new order", () => {
        const order = OrderAggregate.create({
            id: orderId,
            correlationId,
            userId,
            checkoutId,
            customerId: null,
            orderNumber: "ORD-123",
            items: mockItems,
            shippingAddress: mockAddress,
            billingAddress: mockAddress,
            shippingMethod: mockShippingMethod,
            subtotal: 4000,
            shippingCost: 500,
            total: 4900,
        });

        expect(order.id).toBe(orderId);
        expect(order.version).toBe(0);
        expect(order.uncommittedEvents).toHaveLength(1);
        expect(order.uncommittedEvents[0].eventName).toBe("order.created");

        const state = order.toSnapshot();
        expect(state.orderNumber).toBe("ORD-123");
        expect(state.items).toHaveLength(2);
        expect(state.items[0].quantityFulfilled).toBe(0);
        expect(state.fulfillmentStatus).toBe("unfulfilled");
        expect(state.tax).toBe(300); // 100 + 200
    });

    test("should fulfill items partially", () => {
        const order = OrderAggregate.create({
            id: orderId,
            correlationId,
            userId,
            checkoutId,
            customerId: null,
            orderNumber: "ORD-123",
            items: mockItems,
            shippingAddress: mockAddress,
            billingAddress: mockAddress,
            shippingMethod: mockShippingMethod,
            subtotal: 4000,
            tax: 400,
            shippingCost: 500,
            total: 4900,
        });

        order.uncommittedEvents = [];

        order.fulfillItems([{ variantId: variantId1, quantity: 1 }], userId);

        expect(order.version).toBe(1);
        expect(order.uncommittedEvents).toHaveLength(1);
        expect(order.uncommittedEvents[0].eventName).toBe("order.items_fulfilled");

        const state = order.toSnapshot();
        expect(state.items[0].quantityFulfilled).toBe(1);
        expect(state.items[1].quantityFulfilled).toBe(0);
        expect(state.fulfillmentStatus).toBe("partially_fulfilled");
    });

    test("should fulfill items completely", () => {
        const order = OrderAggregate.create({
            id: orderId,
            correlationId,
            userId,
            checkoutId,
            customerId: null,
            orderNumber: "ORD-123",
            items: mockItems,
            shippingAddress: mockAddress,
            billingAddress: mockAddress,
            shippingMethod: mockShippingMethod,
            subtotal: 4000,
            tax: 400,
            shippingCost: 500,
            total: 4900,
        });

        order.uncommittedEvents = [];

        order.fulfillItems(
            [
                { variantId: variantId1, quantity: 2 },
                { variantId: variantId2, quantity: 1 },
            ],
            userId
        );

        expect(order.version).toBe(1);
        expect(order.uncommittedEvents).toHaveLength(1);
        expect(order.uncommittedEvents[0].eventName).toBe("order.items_fulfilled");

        const state = order.toSnapshot();
        expect(state.items[0].quantityFulfilled).toBe(2);
        expect(state.items[1].quantityFulfilled).toBe(1);
        expect(state.fulfillmentStatus).toBe("fulfilled");
    });

    test("should fail if fulfilling more than ordered", () => {
        const order = OrderAggregate.create({
            id: orderId,
            correlationId,
            userId,
            checkoutId,
            customerId: null,
            orderNumber: "ORD-123",
            items: mockItems,
            shippingAddress: mockAddress,
            billingAddress: mockAddress,
            shippingMethod: mockShippingMethod,
            subtotal: 4000,
            tax: 400,
            shippingCost: 500,
            total: 4900,
        });

        expect(() => {
            order.fulfillItems([{ variantId: variantId1, quantity: 3 }], userId);
        }).toThrow();
    });

    test("should load from snapshot", () => {
        const order = OrderAggregate.create({
            id: orderId,
            correlationId,
            userId,
            checkoutId,
            customerId: null,
            orderNumber: "ORD-123",
            items: mockItems,
            shippingAddress: mockAddress,
            billingAddress: mockAddress,
            shippingMethod: mockShippingMethod,
            subtotal: 4000,
            tax: 400,
            shippingCost: 500,
            total: 4900,
        });

        const snapshot = {
            aggregate_id: order.id,
            correlation_id: correlationId,
            version: order.version,
            payload: JSON.stringify(order.toSnapshot()),
        };

        const loadedOrder = OrderAggregate.loadFromSnapshot(snapshot);

        expect(loadedOrder.id).toBe(order.id);
        expect(loadedOrder.version).toBe(order.version);
        expect(loadedOrder.toSnapshot()).toEqual(order.toSnapshot());
    });
});
