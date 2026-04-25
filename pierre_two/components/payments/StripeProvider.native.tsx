import { type ReactNode } from "react";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { StripeProvider as NativeStripeProvider } from "@stripe/stripe-react-native";
import { getExpoExtraString } from "@/config/expoExtra";

const stripePublishableKey = getExpoExtraString("stripePublishableKey");
const stripeUrlScheme =
  Constants.appOwnership === "expo"
    ? Linking.createURL("/--/")
    : Linking.createURL("");

export function StripeProvider({ children }: { children: ReactNode }) {
  return (
    <NativeStripeProvider
      publishableKey={stripePublishableKey}
      urlScheme={stripeUrlScheme}
    >
      <>{children}</>
    </NativeStripeProvider>
  );
}
