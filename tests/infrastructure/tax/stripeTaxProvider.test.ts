import { describe, expect, test, mock, beforeEach } from "bun:test";
import { StripeTaxProvider } from "../../../src/infrastructure/tax/stripeTaxProvider";

// Mock Stripe Tax Calculation Response
const mockCalculationResponse = {
    id: "tax_calc_123",
    tax_amount_exclusive: 500,
    amount_total: 10500,
    line_items: {
        data: [
            {
                reference: "variant_1",
                amount_tax: 400,
                tax_breakdown: [
                    {
                        tax_rate_details: {
                            percentage_decimal: "8.0",
                        },
                    },
                ],
            },
            {
                reference: "shipping_cost",
                amount_tax: 100,
                tax_breakdown: [
                    {
                        tax_rate_details: {
                            percentage_decimal: "8.0",
                        },
                    },
                ],
            },
        ],
    },
};

const mockStripeTaxCreate = mock(() => Promise.resolve(mockCalculationResponse));

// Mock the Stripe constructor
mock.module("stripe", () => {
    return {
        default: class MockStripe {
            tax = {
                calculations: {
                    create: mockStripeTaxCreate,
                },
            };
            constructor(apiKey: string, config: any) { }
        },
    };
});

describe("StripeTaxProvider", () => {
    let provider: StripeTaxProvider;

    beforeEach(() => {
        provider = new StripeTaxProvider("sk_test_123");
        mockStripeTaxCreate.mockClear();
    });

    test("should calculate tax without shipping cost", async () => {
        const params = {
            currency: "USD",
            lineItems: [
                {
                    reference: "variant_1",
                    amount: 5000,
                    quantity: 1,
                },
            ],
            customer: {
                address: {
                    line1: "123 Main St",
                    country: "US",
                },
            },
        };

        await provider.calculateTax(params);

        expect(mockStripeTaxCreate).toHaveBeenCalledWith(expect.objectContaining({
            line_items: [
                {
                    amount: 5000,
                    reference: "variant_1",
                    quantity: 1,
                    tax_code: undefined,
                    tax_behavior: "exclusive",
                },
            ],
        }));
    });

    test("should handle Stripe API errors", async () => {
        mockStripeTaxCreate.mockRejectedValueOnce(new Error("Invalid address"));

        const params = {
            currency: "USD",
            lineItems: [],
            customer: { address: { line1: "", country: "US" } },
        };

        expect(provider.calculateTax(params)).rejects.toThrow("Tax Provider Error: Invalid address");
    });

    test("should throw error if amount is not an integer", async () => {
        const params = {
            currency: "USD",
            lineItems: [
                {
                    reference: "variant_1",
                    amount: 5000.5, // Float
                    quantity: 1,
                },
            ],
            customer: {
                address: {
                    line1: "123 Main St",
                    country: "US",
                },
            },
        };

        expect(provider.calculateTax(params as any)).rejects.toThrow("must be an integer");
    });

    test("should throw error if shipping cost is not an integer", async () => {
        const params = {
            currency: "USD",
            lineItems: [],
            shippingCost: 100.5,
            customer: {
                address: {
                    line1: "123 Main St",
                    country: "US",
                },
            },
        };

        expect(provider.calculateTax(params as any)).rejects.toThrow("Shipping cost must be an integer");
    });

    test("should calculate tax correctly", async () => {
        const params = {
            currency: "USD",
            lineItems: [
                {
                    reference: "variant_1",
                    amount: 5000,
                    quantity: 1,
                },
            ],
            shippingCost: 1000,
            shippingTaxCode: "txcd_92010001",
            customer: {
                address: {
                    line1: "123 Main St",
                    city: "San Francisco",
                    state: "CA",
                    postalCode: "94105",
                    country: "US",
                },
            },
        };

        const result = await provider.calculateTax(params);

        expect(mockStripeTaxCreate).toHaveBeenCalledWith({
            currency: "usd",
            line_items: [
                {
                    amount: 5000,
                    reference: "variant_1",
                    quantity: 1,
                    tax_code: undefined,
                    tax_behavior: "exclusive",
                },
                {
                    amount: 1000,
                    reference: "shipping_cost",
                    quantity: 1,
                    tax_code: "txcd_92010001",
                    tax_behavior: "exclusive",
                },
            ],
            customer_details: {
                address: {
                    line1: "123 Main St",
                    line2: undefined,
                    city: "San Francisco",
                    state: "CA",
                    postal_code: "94105",
                    country: "US",
                },
                tax_ids: undefined,
            },
            expand: ["line_items"],
        });

        expect(result).toEqual({
            calculationId: "tax_calc_123",
            totalTax: 500,
            totalAmount: 10500,
            lineItemTaxes: [
                {
                    reference: "variant_1",
                    taxAmount: 400,
                    taxRate: 8.0,
                },
            ],
            shippingTax: {
                taxAmount: 100,
                taxRate: 8.0,
            },
        });
    });
});
