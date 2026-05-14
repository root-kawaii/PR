import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/context/ThemeContext";

export default function StripeRedirectScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        if ("canGoBack" in router && typeof router.canGoBack === "function" && router.canGoBack()) {
          router.back();
          return;
        }
      } catch {
        // Fall through to the tabs root if the navigation state is not ready.
      }

      router.replace("/(tabs)");
    }, 30);

    return () => clearTimeout(timeoutId);
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "bottom"]}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          paddingHorizontal: 24,
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ color: theme.textSecondary, textAlign: "center" }}>
          Rientro al pagamento in corso...
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
