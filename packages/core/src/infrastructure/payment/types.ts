export type PaymentIntent = {
    id: string;
    amount: number;
    currency: string;
    status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "succeeded" | "canceled";
    clientSecret: string | null;
    metadata: Record<string, string>;
};

export type TransactionResult = {
    success: boolean;
    transactionId: string;
    amount: number;
    currency: string;
    status: string;
    errorMessage?: string;
    rawResponse?: unknown;
};

export interface PaymentProvider {
    createPaymentIntent(amount: number, currency: string, metadata?: Record<string, string>): Promise<PaymentIntent>;
    confirmPayment(paymentIntentId: string): Promise<TransactionResult>;
    capturePayment(paymentIntentId: string, amount?: number): Promise<TransactionResult>;
    refundPayment(transactionId: string, amount?: number): Promise<TransactionResult>;
}
