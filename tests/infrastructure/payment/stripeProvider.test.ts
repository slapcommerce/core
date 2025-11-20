import { describe, expect, test, mock, beforeEach } from "bun:test";
import { StripeProvider } from "../../../src/infrastructure/payment/stripeProvider";

// Mock Stripe
const mockStripeCreate = mock(() => Promise.resolve({
    id: "pi_123",
    amount: 1000,
    currency: "usd",
    status: "requires_payment_method",
    client_secret: "secret_123",
    metadata: {},
}));

const mockStripeConfirm = mock(() => Promise.resolve({
    id: "pi_123",
    amount: 1000,
    currency: "usd",
    status: "succeeded",
    metadata: {},
}));

const mockStripeCapture = mock(() => Promise.resolve({
    id: "pi_123",
    amount: 1000,
    currency: "usd",
    status: "succeeded",
    metadata: {},
}));

const mockStripeRefund = mock(() => Promise.resolve({
    id: "re_123",
    amount: 1000,
    currency: "usd",
    status: "succeeded",
}));

// Mock the Stripe constructor
mock.module("stripe", () => {
    return {
        default: class MockStripe {
            paymentIntents = {
                create: mockStripeCreate,
                confirm: mockStripeConfirm,
                capture: mockStripeCapture,
            };
            refunds = {
                create: mockStripeRefund,
            };
            constructor(apiKey: string, config: any) { }
        },
    };
});

describe("StripeProvider", () => {
    let provider: StripeProvider;

    beforeEach(() => {
        provider = new StripeProvider("sk_test_123");
        mockStripeCreate.mockClear();
        mockStripeConfirm.mockClear();
        mockStripeCapture.mockClear();
        mockStripeRefund.mockClear();
    });

    test("should create payment intent", async () => {
        const result = await provider.createPaymentIntent(1000, "USD", { orderId: "123" });

        expect(mockStripeCreate).toHaveBeenCalledWith({
            amount: 1000,
            currency: "usd",
            metadata: { orderId: "123" },
            automatic_payment_methods: { enabled: true },
        });

        expect(result).toEqual({
            id: "pi_123",
            amount: 1000,
            currency: "usd",
            status: "requires_payment_method",
            clientSecret: "secret_123",
            metadata: {},
        });
    });

    test("should confirm payment", async () => {
        const result = await provider.confirmPayment("pi_123");

        expect(mockStripeConfirm).toHaveBeenCalledWith("pi_123");
        expect(result.success).toBe(true);
        expect(result.status).toBe("succeeded");
    });

    test("should capture payment", async () => {
        const result = await provider.capturePayment("pi_123");

        expect(mockStripeCapture).toHaveBeenCalledWith("pi_123", {});
        expect(result.success).toBe(true);
    });

    test("should refund payment", async () => {
        const result = await provider.refundPayment("pi_123");

        expect(mockStripeRefund).toHaveBeenCalledWith({ payment_intent: "pi_123" });
        expect(result.success).toBe(true);
        expect(result.transactionId).toBe("re_123");
    });
});
