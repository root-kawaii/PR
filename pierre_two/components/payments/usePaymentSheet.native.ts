import { initStripe, useStripe } from "@stripe/stripe-react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { type PaymentSheetController } from "./usePaymentSheet";

export function usePaymentSheet(): PaymentSheetController {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const stripeUrlScheme =
    Constants.appOwnership === "expo"
      ? Linking.createURL("/--/")
      : Linking.createURL("");

  return {
    configurePaymentSheet: async (publishableKey?: string) => {
      if (!publishableKey) {
        return {
          error: {
            code: "MissingPublishableKey",
            message: "Stripe publishable key is missing from the backend payment response.",
          },
        };
      }

      await initStripe({
        publishableKey,
        urlScheme: stripeUrlScheme,
      });

      return {};
    },
    initPaymentSheet,
    presentPaymentSheet,
    isPaymentSheetAvailable: true,
  };
}
