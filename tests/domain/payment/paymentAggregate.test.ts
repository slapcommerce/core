import { describe, expect, test } from "bun:test";
import { PaymentAggregate } from "../../../src/domain/payment/aggregate";
import { uuidv7 } from "uuidv7";

describe("PaymentAggregate", () => {
    const userId = uuidv7();
    const paymentId = uuidv7();
    const correlationId = uuidv7();
    const orderId = uuidv7();

    test("should create a new payment", () => {
        const payment = PaymentAggregate.create({
            id: paymentId,
            correlationId,
            userId,
            orderId,
            amount: 5000,
            currency: "USD",
            provider: "stripe",
        });

        expect(payment.id).toBe(paymentId);
        expect(payment.version).toBe(0);
        expect(payment.uncommittedEvents).toHaveLength(1);
        expect(payment.uncommittedEvents[0].eventName).toBe("payment.initiated");

        const state = payment.toSnapshot();
        expect(state.orderId).toBe(orderId);
        expect(state.amount).toBe(5000);
        expect(state.status).toBe("pending");
    });

    test("should mark as succeeded", () => {
        const payment = PaymentAggregate.create({
            id: paymentId,
            correlationId,
            userId,
            orderId,
            amount: 5000,
            currency: "USD",
            provider: "stripe",
        });

        payment.uncommittedEvents = [];

        const providerTransactionId = "txn_123";
        payment.markAsSucceeded(providerTransactionId, userId);

        expect(payment.version).toBe(1);
        expect(payment.uncommittedEvents).toHaveLength(1);
        expect(payment.uncommittedEvents[0].eventName).toBe("payment.succeeded");

        const state = payment.toSnapshot();
        expect(state.status).toBe("succeeded");
        expect(state.providerTransactionId).toBe(providerTransactionId);
    });

    test("should mark as failed", () => {
        const payment = PaymentAggregate.create({
            id: paymentId,
            correlationId,
            userId,
            orderId,
            amount: 5000,
            currency: "USD",
            provider: "stripe",
        });

        payment.uncommittedEvents = [];

        const errorMessage = "Card declined";
        payment.markAsFailed(errorMessage, userId);

        expect(payment.version).toBe(1);
        expect(payment.uncommittedEvents).toHaveLength(1);
        expect(payment.uncommittedEvents[0].eventName).toBe("payment.failed");

        const state = payment.toSnapshot();
        expect(state.status).toBe("failed");
        expect(state.errorMessage).toBe(errorMessage);
    });

    test("should refund payment", () => {
        const payment = PaymentAggregate.create({
            id: paymentId,
            correlationId,
            userId,
            orderId,
            amount: 5000,
            currency: "USD",
            provider: "stripe",
        });

        payment.markAsSucceeded("txn_123", userId);
        payment.uncommittedEvents = [];

        payment.refund(userId);

        expect(payment.version).toBe(2);
        expect(payment.uncommittedEvents).toHaveLength(1);
        expect(payment.uncommittedEvents[0].eventName).toBe("payment.refunded");

        const state = payment.toSnapshot();
        expect(state.status).toBe("refunded");
    });

    test("should load from snapshot", () => {
        const payment = PaymentAggregate.create({
            id: paymentId,
            correlationId,
            userId,
            orderId,
            amount: 5000,
            currency: "USD",
            provider: "stripe",
        });

        const snapshot = {
            aggregate_id: payment.id,
            correlation_id: correlationId,
            version: payment.version,
            payload: JSON.stringify(payment.toSnapshot()),
        };

        const loadedPayment = PaymentAggregate.loadFromSnapshot(snapshot);

        expect(loadedPayment.id).toBe(payment.id);
        expect(loadedPayment.version).toBe(payment.version);
        expect(loadedPayment.toSnapshot()).toEqual(payment.toSnapshot());
    });
});
