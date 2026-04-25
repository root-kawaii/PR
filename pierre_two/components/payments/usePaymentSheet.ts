export type PaymentSheetError = {
  code?: string;
  message?: string;
};

export type InitPaymentSheetParams = {
  paymentIntentClientSecret: string;
  merchantDisplayName: string;
  returnURL: string;
};

export type PaymentSheetResult = Promise<{ error?: PaymentSheetError }>;

export type PaymentSheetController = {
  configurePaymentSheet: (publishableKey?: string) => PaymentSheetResult;
  initPaymentSheet: (params: InitPaymentSheetParams) => PaymentSheetResult;
  presentPaymentSheet: () => PaymentSheetResult;
  isPaymentSheetAvailable: boolean;
};

const supportedPaymentSheetResult = async (): PaymentSheetResult => ({});

const unsupportedPaymentSheetResult = async (): PaymentSheetResult => ({
  error: {
    code: "UnsupportedPlatform",
    message: "Stripe Payment Sheet is not available on this platform.",
  },
});

export function usePaymentSheet(): PaymentSheetController {
  return {
    configurePaymentSheet: (_publishableKey?: string) => supportedPaymentSheetResult(),
    initPaymentSheet: (_params: InitPaymentSheetParams) => unsupportedPaymentSheetResult(),
    presentPaymentSheet: unsupportedPaymentSheetResult,
    isPaymentSheetAvailable: false,
  };
}
