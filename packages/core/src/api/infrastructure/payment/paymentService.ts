import { StripeProvider } from "./stripeProvider";
import type { PaymentProvider } from "./types";

let paymentProviderInstance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
    if (paymentProviderInstance) {
        return paymentProviderInstance;
    }

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        // In development, we might want to warn or use a mock if not configured
        if (process.env.NODE_ENV === "production") {
            throw new Error("STRIPE_SECRET_KEY is not defined in environment variables.");
        }
        console.warn("STRIPE_SECRET_KEY is missing. Payment operations will fail.");
    }

    // Default to Stripe for now
    paymentProviderInstance = new StripeProvider(apiKey || "sk_test_placeholder");
    return paymentProviderInstance;
}
