import { StripeTaxProvider } from "./stripeTaxProvider";
import type { TaxProvider } from "./types";

let taxProviderInstance: TaxProvider | null = null;

export function getTaxProvider(): TaxProvider {
    if (taxProviderInstance) {
        return taxProviderInstance;
    }

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("STRIPE_SECRET_KEY is not defined in environment variables.");
        }
        console.warn("STRIPE_SECRET_KEY is missing. Tax operations will fail.");
    }

    taxProviderInstance = new StripeTaxProvider(apiKey || "sk_test_placeholder");
    return taxProviderInstance;
}
