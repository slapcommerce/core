import Stripe from "stripe";
import type { TaxCalculationParams, TaxCalculationResult, TaxProvider } from "./types";

export class StripeTaxProvider implements TaxProvider {
    private stripe: Stripe;

    constructor(apiKey: string) {
        this.stripe = new Stripe(apiKey, {
            apiVersion: "2025-11-17.clover",
        });
    }

    async calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult> {
        try {
            const lineItems: Stripe.Tax.CalculationCreateParams.LineItem[] = params.lineItems.map(item => {
                if (!Number.isInteger(item.amount)) {
                    throw new Error(`Tax Provider Error: Amount for item ${item.reference} must be an integer (cents). Got ${item.amount}`);
                }
                return {
                    amount: item.amount,
                    reference: item.reference,
                    quantity: item.quantity,
                    tax_code: item.taxCode,
                    tax_behavior: "exclusive", // We assume prices are exclusive of tax by default
                };
            });

            if (params.shippingCost !== undefined) {
                if (!Number.isInteger(params.shippingCost)) {
                    throw new Error(`Tax Provider Error: Shipping cost must be an integer (cents). Got ${params.shippingCost}`);
                }
                lineItems.push({
                    amount: params.shippingCost,
                    reference: "shipping_cost",
                    quantity: 1,
                    tax_code: params.shippingTaxCode || "txcd_92010001", // Use provided code or standard shipping default
                    tax_behavior: "exclusive",
                });
            }

            const calculation = await this.stripe.tax.calculations.create({
                currency: params.currency.toLowerCase(),
                line_items: lineItems,
                customer_details: {
                    address: {
                        line1: params.customer.address.line1,
                        line2: params.customer.address.line2,
                        city: params.customer.address.city,
                        state: params.customer.address.state,
                        postal_code: params.customer.address.postalCode,
                        country: params.customer.address.country,
                    },
                    tax_ids: params.customer.taxId ? [{
                        type: params.customer.taxId.type as Stripe.Tax.CalculationCreateParams.CustomerDetails.TaxId.Type,
                        value: params.customer.taxId.value,
                    }] : undefined,
                },
                expand: ["line_items"],
            });

            return this.mapToTaxCalculationResult(calculation);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    private mapToTaxCalculationResult(calculation: Stripe.Tax.Calculation): TaxCalculationResult {
        const lineItemTaxes = calculation.line_items?.data
            .filter(item => item.reference !== "shipping_cost")
            .map(item => ({
                reference: item.reference || "",
                taxAmount: item.amount_tax,
                taxRate: item.tax_breakdown?.[0]?.tax_rate_details?.percentage_decimal
                    ? parseFloat(item.tax_breakdown[0].tax_rate_details.percentage_decimal)
                    : 0,
            })) || [];

        const shippingItem = calculation.line_items?.data.find(item => item.reference === "shipping_cost");
        const shippingTax = shippingItem ? {
            taxAmount: shippingItem.amount_tax,
            taxRate: shippingItem.tax_breakdown?.[0]?.tax_rate_details?.percentage_decimal
                ? parseFloat(shippingItem.tax_breakdown[0].tax_rate_details.percentage_decimal)
                : 0,
        } : undefined;

        return {
            calculationId: calculation.id!,
            totalTax: calculation.tax_amount_exclusive,
            totalAmount: calculation.amount_total,
            lineItemTaxes,
            shippingTax,
        };
    }

    private handleError(error: unknown): never {
        console.error("Stripe Tax Error:", error);
        if (error instanceof Error) {
            throw new Error(`Tax Provider Error: ${error.message}`);
        }
        throw new Error("Unknown Tax Provider Error");
    }
}
