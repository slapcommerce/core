import { describe, expect, test } from "bun:test";
import { FulfillmentAggregate } from "../../../src/domain/fulfillment/aggregate";
import { uuidv7 } from "uuidv7";

describe("FulfillmentAggregate", () => {
    const userId = uuidv7();
    const fulfillmentId = uuidv7();
    const correlationId = uuidv7();
    const orderId = uuidv7();
    const variantId = uuidv7();

    test("should create a new fulfillment", () => {
        const fulfillment = FulfillmentAggregate.create({
            id: fulfillmentId,
            correlationId,
            userId,
            orderId,
            items: [{ variantId, quantity: 2 }],
        });

        expect(fulfillment.id).toBe(fulfillmentId);
        expect(fulfillment.version).toBe(0);
        expect(fulfillment.uncommittedEvents).toHaveLength(1);
        expect(fulfillment.uncommittedEvents[0].eventName).toBe("fulfillment.created");

        const state = fulfillment.toSnapshot();
        expect(state.orderId).toBe(orderId);
        expect(state.items).toHaveLength(1);
        expect(state.items[0].quantity).toBe(2);
        expect(state.status).toBe("pending");
    });

    test("should mark as shipped", () => {
        const fulfillment = FulfillmentAggregate.create({
            id: fulfillmentId,
            correlationId,
            userId,
            orderId,
            items: [{ variantId, quantity: 2 }],
        });

        fulfillment.uncommittedEvents = [];

        const trackingNumber = "TRACK123";
        const carrier = "UPS";
        fulfillment.markAsShipped(trackingNumber, carrier, userId);

        expect(fulfillment.version).toBe(1);
        expect(fulfillment.uncommittedEvents).toHaveLength(1);
        expect(fulfillment.uncommittedEvents[0].eventName).toBe("fulfillment.shipped");

        const state = fulfillment.toSnapshot();
        expect(state.status).toBe("shipped");
        expect(state.trackingNumber).toBe(trackingNumber);
        expect(state.carrier).toBe(carrier);
        expect(state.shippedAt).toBeDefined();
    });

    test("should mark as delivered", () => {
        const fulfillment = FulfillmentAggregate.create({
            id: fulfillmentId,
            correlationId,
            userId,
            orderId,
            items: [{ variantId, quantity: 2 }],
        });

        fulfillment.markAsShipped("TRACK123", "UPS", userId);
        fulfillment.uncommittedEvents = [];

        fulfillment.markAsDelivered(userId);

        expect(fulfillment.version).toBe(2);
        expect(fulfillment.uncommittedEvents).toHaveLength(1);
        expect(fulfillment.uncommittedEvents[0].eventName).toBe("fulfillment.delivered");

        const state = fulfillment.toSnapshot();
        expect(state.status).toBe("delivered");
        expect(state.deliveredAt).toBeDefined();
    });

    test("should cancel fulfillment", () => {
        const fulfillment = FulfillmentAggregate.create({
            id: fulfillmentId,
            correlationId,
            userId,
            orderId,
            items: [{ variantId, quantity: 2 }],
        });

        fulfillment.uncommittedEvents = [];

        fulfillment.cancel(userId);

        expect(fulfillment.version).toBe(1);
        expect(fulfillment.uncommittedEvents).toHaveLength(1);
        expect(fulfillment.uncommittedEvents[0].eventName).toBe("fulfillment.cancelled");

        const state = fulfillment.toSnapshot();
        expect(state.status).toBe("cancelled");
    });

    test("should load from snapshot", () => {
        const fulfillment = FulfillmentAggregate.create({
            id: fulfillmentId,
            correlationId,
            userId,
            orderId,
            items: [{ variantId, quantity: 2 }],
        });

        const snapshot = {
            aggregate_id: fulfillment.id,
            version: fulfillment.version,
            payload: JSON.stringify(fulfillment.toSnapshot()),
        };

        const loadedFulfillment = FulfillmentAggregate.loadFromSnapshot(snapshot);

        expect(loadedFulfillment.id).toBe(fulfillment.id);
        expect(loadedFulfillment.version).toBe(fulfillment.version);
        expect(loadedFulfillment.toSnapshot()).toEqual(fulfillment.toSnapshot());
    });
});
