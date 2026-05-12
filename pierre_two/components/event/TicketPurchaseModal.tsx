import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { usePaymentSheet } from "@/components/payments/usePaymentSheet";
import { API_URL } from "@/config/api";
import { trackEvent } from "@/config/analytics";
import { useTheme } from "@/context/ThemeContext";
import { useApiFetch } from "@/config/apiFetch";
import { useAuth } from "@/context/AuthContext";
import { Event } from "@/types";
import {
  formatEventDateTimeLabel,
  getEventPriceLabel,
  getEventVenueLabel,
  resolveEventTicketingMode,
} from "@/utils/eventDisplay";

type TicketPurchaseModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onPurchaseCompleted?: () => void;
};

export function TicketPurchaseModal({
  visible,
  event,
  onClose,
  onPurchaseCompleted,
}: TicketPurchaseModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const apiFetch = useApiFetch();
  const router = useRouter();
  const {
    configurePaymentSheet,
    initPaymentSheet,
    presentPaymentSheet,
    isPaymentSheetAvailable,
  } = usePaymentSheet();
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [visible]);

  if (!event) {
    return null;
  }

  const venueLabel = getEventVenueLabel(event);
  const ticketPriceLabel = getEventPriceLabel(event);
  const ticketingMode = resolveEventTicketingMode(event);
  const isFreeTicket = ticketingMode === "free";

  const handlePurchase = async () => {
    if (!user) {
      Alert.alert("Accesso richiesto", "Effettua il login per acquistare il biglietto.");
      return;
    }

    if (ticketingMode === "none") {
      Alert.alert("Biglietto non disponibile", "Questo evento non prevede ticket.");
      return;
    }

    if (!isFreeTicket && !ticketPriceLabel) {
      Alert.alert("Biglietto non disponibile", "Questo evento non ha un prezzo ticket valido.");
      return;
    }

    if (loading || inFlightRef.current) {
      return;
    }

    if (!isFreeTicket && !isPaymentSheetAvailable) {
      Alert.alert(
        "Pagamento non disponibile",
        "L'acquisto ticket funziona solo dall'app mobile."
      );
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    try {
      trackEvent("ticket_purchase_flow_started", {
        event_id: event.id,
        event_title: event.title,
        ticketing_mode: ticketingMode,
      });

      if (isFreeTicket) {
        const claimResponse = await apiFetch(`${API_URL}/tickets/claim-free`, {
          method: "POST",
          body: JSON.stringify({ event_id: event.id }),
        });

        if (!claimResponse.ok) {
          const errorText = await claimResponse.text();
          throw new Error(errorText || "free_ticket_claim_failed");
        }

        trackEvent("ticket_purchase_flow_completed", {
          event_id: event.id,
          event_title: event.title,
          ticketing_mode: ticketingMode,
        });

        onPurchaseCompleted?.();
        onClose();
        router.push("/(tabs)/tickets");
        Alert.alert("Ticket ottenuto", "Trovi il ticket nella sezione I miei acquisti.");
        return;
      }

      const paymentIntentResponse = await apiFetch(
        `${API_URL}/tickets/purchase/payment-intent`,
        {
          method: "POST",
          body: JSON.stringify({ event_id: event.id }),
        }
      );

      if (!paymentIntentResponse.ok) {
        const errorText = await paymentIntentResponse.text();
        throw new Error(errorText || "ticket_payment_intent_failed");
      }

      const paymentIntentData = await paymentIntentResponse.json();
      const { error: configureError } = await configurePaymentSheet(
        paymentIntentData.stripePublishableKey
      );

      if (configureError) {
        throw new Error(configureError.message || "payment_sheet_config_failed");
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentData.clientSecret,
        merchantDisplayName: "Pierre Two",
        returnURL: Linking.createURL("stripe-redirect"),
      });

      if (initError) {
        throw new Error(initError.message || "payment_sheet_init_failed");
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          throw new Error(presentError.message || "payment_sheet_failed");
        }
        return;
      }

      const confirmResponse = await apiFetch(
        `${API_URL}/tickets/purchase/confirm`,
        {
          method: "POST",
          body: JSON.stringify({
            event_id: event.id,
            stripe_payment_intent_id: paymentIntentData.paymentIntentId,
          }),
        }
      );

      if (!confirmResponse.ok) {
        const errorText = await confirmResponse.text();
        throw new Error(errorText || "ticket_confirm_failed");
      }

      trackEvent("ticket_purchase_flow_completed", {
        event_id: event.id,
        event_title: event.title,
        ticketing_mode: ticketingMode,
      });

      onPurchaseCompleted?.();
      onClose();
      router.push("/(tabs)/tickets");
      Alert.alert("Biglietto acquistato", "Trovi il ticket nella sezione I miei acquisti.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Non è stato possibile completare l'acquisto del ticket.";
      trackEvent("ticket_purchase_flow_failed", {
        event_id: event.id,
        error_message: message,
        ticketing_mode: ticketingMode,
      });
      Alert.alert(
        "Errore",
        isFreeTicket
          ? "Non è stato possibile ottenere il ticket gratuito."
          : "Non è stato possibile completare l'acquisto del ticket."
      );
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={theme.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
              {isFreeTicket ? "Ottieni ticket" : "Acquista biglietto"}
            </ThemedText>
            <View style={styles.backButton} />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.heroCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
              <View style={[styles.badge, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}3D` }]}>
                <IconSymbol name="ticket.fill" size={14} color={theme.primary} />
                <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                  {isFreeTicket ? "Ticket gratuito" : "Ingresso evento"}
                </ThemedText>
              </View>
              <ThemedText style={[styles.title, { color: theme.text }]}>
                {event.title}
              </ThemedText>
              {venueLabel ? (
                <View style={styles.metaRow}>
                  <IconSymbol name="mappin" size={15} color={theme.textSecondary} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {venueLabel}
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <IconSymbol name="calendar" size={15} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {formatEventDateTimeLabel(event)}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.priceCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
              <ThemedText style={[styles.priceLabel, { color: theme.textTertiary }]}>
                {isFreeTicket ? "Costo" : "Totale"}
              </ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                {isFreeTicket ? "Gratis" : ticketPriceLabel}
              </ThemedText>
              <ThemedText style={[styles.caption, { color: theme.textTertiary }]}>
                {isFreeTicket
                  ? "La conferma genera un ticket personale senza pagamento."
                  : "Un acquisto corrisponde a un ticket personale."}
              </ThemedText>
            </View>

            <View style={[styles.noticeCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
              <ThemedText style={[styles.noticeTitle, { color: theme.text }]}>
                Flusso separato dal tavolo
              </ThemedText>
              <ThemedText style={[styles.noticeText, { color: theme.textTertiary }]}>
                {isFreeTicket
                  ? "Il ticket gratuito conferma l&apos;ingresso all&apos;evento. La prenotazione area, se disponibile, resta un flusso distinto."
                  : "Il biglietto copre l&apos;ingresso all&apos;evento. La prenotazione area, se disponibile, resta un flusso distinto."}
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.ctaWrap, loading && styles.disabled]}
              activeOpacity={0.85}
              disabled={loading}
              onPress={handlePurchase}
            >
              <LinearGradient
                colors={theme.gradientPrimary as [string, string]}
                style={styles.cta}
              >
                {loading ? (
                  <ActivityIndicator color={theme.textInverse} />
                ) : (
                  <>
                    <IconSymbol name="ticket.fill" size={18} color={theme.textInverse} />
                    <ThemedText style={[styles.ctaText, { color: theme.textInverse }]}>
                      {isFreeTicket ? "Conferma ticket" : "Paga e acquista ticket"}
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    flex: 1,
  },
  priceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  caption: {
    fontSize: 13,
    textAlign: "center",
  },
  noticeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  ctaWrap: {
    marginTop: 4,
  },
  cta: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
});
