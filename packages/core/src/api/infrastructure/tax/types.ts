export type TaxLineItem = {
    reference: string;
    amount: number; // in cents
    taxCode?: string;
    quantity: number;
};

export type TaxCalculationParams = {
    currency: string;
    lineItems: TaxLineItem[];
    shippingCost?: number; // in cents
    shippingTaxCode?: string;
    customer: {
        address: {
            line1: string;
            line2?: string;
            city?: string;
            state?: string;
            postalCode?: string;
            country: string;
        };
        taxId?: {
            type: string;
            value: string;
        };
    };
};

export type TaxCalculationResult = {
    calculationId: string;
    totalTax: number; // in cents
    totalAmount: number; // in cents (inclusive of tax)
    lineItemTaxes: {
        reference: string;
        taxAmount: number; // in cents
        taxRate: number; // percentage (e.g., 8.0 for 8%)
    }[];
    shippingTax?: {
        taxAmount: number;
        taxRate: number;
    };
};

export interface TaxProvider {
    calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult>;
}
