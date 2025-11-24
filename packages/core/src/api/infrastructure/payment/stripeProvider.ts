import Stripe from "stripe";
import type { PaymentIntent, PaymentProvider, TransactionResult } from "./types";

export class StripeProvider implements PaymentProvider {
    private stripe: Stripe;

    constructor(apiKey: string) {
        this.stripe = new Stripe(apiKey, {
            apiVersion: "2025-11-17.clover",
        });
    }

    async createPaymentIntent(
        amount: number,
        currency: string,
        metadata?: Record<string, string>
    ): Promise<PaymentIntent> {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount), // Stripe expects integers (cents)
                currency: currency.toLowerCase(),
                metadata,
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return this.mapToPaymentIntent(paymentIntent);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async confirmPayment(paymentIntentId: string): Promise<TransactionResult> {
        try {
            const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
            return this.mapToTransactionResult(paymentIntent);
        } catch (error) {
            return this.handleErrorResult(error);
        }
    }

    async capturePayment(paymentIntentId: string, amount?: number): Promise<TransactionResult> {
        try {
            const options: Stripe.PaymentIntentCaptureParams = {};
            if (amount) {
                options.amount_to_capture = Math.round(amount);
            }

            const paymentIntent = await this.stripe.paymentIntents.capture(paymentIntentId, options);
            return this.mapToTransactionResult(paymentIntent);
        } catch (error) {
            return this.handleErrorResult(error);
        }
    }

    async refundPayment(transactionId: string, amount?: number): Promise<TransactionResult> {
        try {
            const options: Stripe.RefundCreateParams = {
                payment_intent: transactionId,
            };
            if (amount) {
                options.amount = Math.round(amount);
            }

            const refund = await this.stripe.refunds.create(options);

            return {
                success: refund.status === "succeeded" || refund.status === "pending",
                transactionId: refund.id,
                amount: refund.amount,
                currency: refund.currency,
                status: refund.status || "unknown",
                rawResponse: refund,
            };
        } catch (error) {
            return this.handleErrorResult(error);
        }
    }

    private mapToPaymentIntent(stripePaymentIntent: Stripe.PaymentIntent): PaymentIntent {
        return {
            id: stripePaymentIntent.id,
            amount: stripePaymentIntent.amount,
            currency: stripePaymentIntent.currency,
            status: stripePaymentIntent.status as PaymentIntent["status"],
            clientSecret: stripePaymentIntent.client_secret,
            metadata: stripePaymentIntent.metadata,
        };
    }

    private mapToTransactionResult(stripePaymentIntent: Stripe.PaymentIntent): TransactionResult {
        return {
            success: stripePaymentIntent.status === "succeeded",
            transactionId: stripePaymentIntent.id,
            amount: stripePaymentIntent.amount,
            currency: stripePaymentIntent.currency,
            status: stripePaymentIntent.status,
            rawResponse: stripePaymentIntent,
        };
    }

    private handleError(error: unknown): never {
        console.error("Stripe Error:", error);
        if (error instanceof Error) {
            throw new Error(`Payment Provider Error: ${error.message}`);
        }
        throw new Error("Unknown Payment Provider Error");
    }

    private handleErrorResult(error: unknown): TransactionResult {
        console.error("Stripe Operation Failed:", error);
        let errorMessage = "Unknown error";
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return {
            success: false,
            transactionId: "",
            amount: 0,
            currency: "",
            status: "failed",
            errorMessage,
        };
    }
}
