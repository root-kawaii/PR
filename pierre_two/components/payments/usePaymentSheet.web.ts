import {
  type InitPaymentSheetParams,
  type PaymentSheetController,
  type PaymentSheetResult,
} from "./usePaymentSheet";

const unsupportedPaymentSheetResult = async (): PaymentSheetResult => ({
  error: {
    code: "UnsupportedPlatform",
    message: "Stripe Payment Sheet is not available on web.",
  },
});

export function usePaymentSheet(): PaymentSheetController {
  return {
    configurePaymentSheet: (_publishableKey?: string) => unsupportedPaymentSheetResult(),
    initPaymentSheet: (_params: InitPaymentSheetParams) => unsupportedPaymentSheetResult(),
    presentPaymentSheet: unsupportedPaymentSheetResult,
    isPaymentSheetAvailable: false,
  };
}
