import { useState, useEffect, useRef } from "react";
import {
  Modal,
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Table, Event } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/context/ThemeContext";
import { trackEvent } from "@/config/analytics";
import { useStripe } from "@stripe/stripe-react-native";
import { API_URL } from "@/config/api";

type TableReservationModalProps = {
  visible: boolean;
  table: Table | null;
  event: Event | null;
  onClose: () => void;
};

export const TableReservationModal = ({
  visible,
  table,
  event,
  onClose,
}: TableReservationModalProps) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const paymentFlowInProgressRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setLoading(false);
      paymentFlowInProgressRef.current = false;
    }
  }, [visible]);

  // Owner's share = total_cost / capacity (same formula as backend)
  const rawCost = parseFloat((table?.totalCost || "0").replace(/[^0-9.]/g, ""));
  const tableTotalCost = isNaN(rawCost) || rawCost < 0 ? 0 : rawCost;
  const ownerShare = table?.capacity
    ? Math.round((tableTotalCost / table.capacity) * 100) / 100
    : 0;

  useEffect(() => {
    if (!visible || !table || !event) {
      return;
    }

    trackEvent("table_reservation_modal_opened", {
      event_id: event.id,
      table_id: table.id,
      table_name: table.name,
      owner_share: ownerShare,
    });
  }, [event?.id, ownerShare, table?.id, visible]);

  if (!table || !event) return null;

  const handleReservation = async () => {
    if (!user) {
      Alert.alert("Errore", "Devi effettuare il login per prenotare un tavolo");
      return;
    }

    if (loading || paymentFlowInProgressRef.current) {
      return;
    }

    paymentFlowInProgressRef.current = true;
    setLoading(true);

    let failureTracked = false;
    const trackReservationFailure = (step: string, errorMessage: string) => {
      failureTracked = true;
      trackEvent("table_reservation_flow_failed", {
        event_id: event.id,
        table_id: table.id,
        step,
        error_message: errorMessage,
      });
    };

    try {
      trackEvent("table_reservation_flow_started", {
        event_id: event.id,
        table_id: table.id,
        owner_share: ownerShare,
      });

      // Step 1: Create Stripe PaymentIntent for owner's share
      const paymentIntentResponse = await fetch(
        `${API_URL}/reservations/create-payment-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table_id: table.id,
            event_id: event.id,
            owner_user_id: user.id,
            contact_name: user.name,
            contact_email: user.email,
            contact_phone: user.phone_number || "",
            special_requests: null,
          }),
        }
      );

      if (!paymentIntentResponse.ok) {
        const errorText = await paymentIntentResponse.text();
        trackReservationFailure("create_payment_intent", errorText || "payment_intent_failed");
        throw new Error(`Failed to create payment intent: ${errorText}`);
      }

      const paymentIntentData = await paymentIntentResponse.json();

      // Step 2: Present Stripe payment sheet for owner's share
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentData.clientSecret,
        merchantDisplayName: "Pierre Two",
        returnURL: "pierre-two://stripe-redirect",
      });

      if (initError) {
        trackReservationFailure("init_payment_sheet", initError.message || "payment_sheet_init_failed");
        Alert.alert("Errore", "Impossibile inizializzare il pagamento. Riprova.");
        setLoading(false);
        return;
      }

      trackEvent("table_reservation_payment_sheet_presented", {
        event_id: event.id,
        table_id: table.id,
      });

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          trackReservationFailure("present_payment_sheet", presentError.message || "payment_sheet_failed");
          Alert.alert("Errore", "Pagamento non riuscito. Riprova.");
        } else {
          trackEvent("table_reservation_payment_cancelled", {
            event_id: event.id,
            table_id: table.id,
          });
        }
        setLoading(false);
        return;
      }

      // Step 3: Create reservation — generates the shared link
      const reservationResponse = await fetch(
        `${API_URL}/reservations/create-with-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table_id: table.id,
            event_id: event.id,
            owner_user_id: user.id,
            stripe_payment_intent_id: paymentIntentData.paymentIntentId,
            contact_name: user.name,
            contact_email: user.email,
            contact_phone: user.phone_number || "",
            special_requests: null,
          }),
        }
      );

      if (!reservationResponse.ok) {
        const errorText = await reservationResponse.text();
        trackReservationFailure("create_reservation", errorText || "reservation_failed");
        throw new Error(`Failed to create reservation: ${errorText}`);
      }

      const data = await reservationResponse.json();
      const shareLink: string = data.shareLink || "";

      trackEvent("table_reservation_flow_completed", {
        event_id: event.id,
        table_id: table.id,
        reservation_id: data.reservation?.id || null,
        has_share_link: Boolean(shareLink),
      });

      // Show share sheet immediately with the link
      if (shareLink) {
        try {
          trackEvent("table_reservation_share_sheet_opened", {
            event_id: event.id,
            table_id: table.id,
          });
          await Share.share({
            message: `Unisciti al mio tavolo "${table.name}" all'evento "${event.title}"! Paga la tua quota qui: ${shareLink}`,
            url: shareLink,
          });
        } catch (_) {
          // User cancelled share — that's fine
        }
      } else {
        Alert.alert(
          "Prenotazione Confermata!",
          `Codice: ${data.reservation?.reservationCode}\nLa tua quota: €${ownerShare.toFixed(2)}\n\nPuoi condividere il link dalla schermata prenotazioni.`
        );
      }

      onClose();
    } catch (error) {
      if (!failureTracked) {
        trackReservationFailure(
          "unexpected",
          error instanceof Error ? error.message : "unknown_error",
        );
      }
      console.error("Reservation error:", error);
      Alert.alert(
        "Errore",
        "Non è stato possibile completare la prenotazione. Riprova più tardi."
      );
    } finally {
      setLoading(false);
      paymentFlowInProgressRef.current = false;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient
          colors={[theme.primaryDark, theme.primary, theme.primaryLight] as [string, string, string]}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <ThemedText style={styles.headerEyebrow}>Prenotazione Tavolo</ThemedText>
              <ThemedText style={styles.headerTitle}>Paga la Tua Quota</ThemedText>
            </View>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
          >
            {/* Table Info Card */}
            <View style={styles.tableInfoCard}>
              <View style={styles.tableBadge}>
                <IconSymbol name="wineglass.fill" size={12} color="#fff" />
                <ThemedText style={styles.tableBadgeText}>Esperienza VIP</ThemedText>
              </View>
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={16} color="#fff" />
                <ThemedText style={styles.tableName}>
                  {table.name}{table.zone ? ` - ${table.zone}` : ""}
                </ThemedText>
              </View>

              <View style={styles.eventInfo}>
                <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
                <ThemedText style={styles.eventVenue}>{event.venue}</ThemedText>
                <ThemedText style={styles.eventDate}>{event.date}</ThemedText>
              </View>

              {(table.features?.length || table.locationDescription) ? (
                <View style={styles.characteristicsSection}>
                  <ThemedText style={styles.sectionTitle}>Caratteristiche Tavolo:</ThemedText>
                  {table.features?.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <ThemedText style={styles.bulletPoint}>•</ThemedText>
                      <ThemedText style={styles.featureText}>{feature}</ThemedText>
                    </View>
                  ))}
                  {table.locationDescription && (
                    <View style={styles.featureRow}>
                      <ThemedText style={styles.bulletPoint}>•</ThemedText>
                      <ThemedText style={styles.featureText}>{table.locationDescription}</ThemedText>
                    </View>
                  )}
                </View>
              ) : null}
            </View>

            {/* Payment Summary */}
            <View style={styles.spendSection}>
              <ThemedText style={styles.spendTitle}>Riepilogo</ThemedText>

              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Costo tavolo:</ThemedText>
                  <ThemedText style={styles.infoValue}>€{tableTotalCost.toFixed(2)}</ThemedText>
                </View>

                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Persone al tavolo:</ThemedText>
                  <ThemedText style={styles.infoValue}>{table.capacity}</ThemedText>
                </View>

                <View style={[styles.infoRow, styles.totalRow]}>
                  <ThemedText style={styles.totalLabel}>La tua quota:</ThemedText>
                  <ThemedText style={[styles.infoValue, styles.highlightValue]}>
                    €{ownerShare.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={styles.linkHint}>
                Dopo il pagamento riceverai un link da condividere con gli altri partecipanti.
              </ThemedText>
            </View>

            {/* Your Info */}
            <View style={styles.personalInfoSection}>
              <ThemedText style={styles.sectionTitle}>Le Tue Informazioni</ThemedText>
              <View style={styles.userInfoDisplay}>
                <View style={styles.userInfoRow}>
                  <IconSymbol name="person" size={16} color={theme.primary} />
                  <ThemedText style={styles.userInfoText}>{user?.name}</ThemedText>
                </View>
                <View style={styles.userInfoRow}>
                  <IconSymbol name="checkmark.circle" size={16} color={theme.primary} />
                  <ThemedText style={styles.userInfoText}>{user?.email}</ThemedText>
                </View>
                {user?.phone_number && (
                  <View style={styles.userInfoRow}>
                    <IconSymbol name="checkmark.circle" size={16} color={theme.primary} />
                    <ThemedText style={styles.userInfoText}>{user.phone_number}</ThemedText>
                  </View>
                )}
              </View>
            </View>

            {/* Reserve Button */}
            <TouchableOpacity
              style={[styles.reserveButton, loading && styles.reserveButtonDisabled]}
              onPress={handleReservation}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol name="checkmark.circle" size={20} color="#fff" />
                  <ThemedText style={styles.reserveButtonText}>
                    PAGA €{ownerShare.toFixed(2)} E PRENOTA
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 22,
  },
  backButtonPlaceholder: { width: 44, height: 44 },
  headerTitleWrap: { alignItems: "center", gap: 2 },
  headerEyebrow: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: 1.2 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scrollView: { flex: 1 },
  tableInfoCard: {
    margin: 16,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 16,
  },
  tableBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    marginBottom: 14,
  },
  tableBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff", textTransform: "uppercase", letterSpacing: 0.8 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  tableName: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  eventInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
  },
  eventTitle: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  eventVenue: { fontSize: 14, color: "rgba(255, 255, 255, 0.9)", marginBottom: 2 },
  eventDate: { fontSize: 14, color: "rgba(255, 255, 255, 0.8)" },
  characteristicsSection: { gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  featureRow: { flexDirection: "row", gap: 8 },
  bulletPoint: { color: "#fff", fontSize: 14 },
  featureText: { flex: 1, fontSize: 13, color: "rgba(255, 255, 255, 0.9)" },
  spendSection: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  spendTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", marginBottom: 12 },
  infoBox: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: 13, color: "rgba(255, 255, 255, 0.9)" },
  infoValue: { fontSize: 14, fontWeight: "bold", color: "#fff" },
  highlightValue: { fontSize: 20, color: "#fbbf24" },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  totalLabel: { fontSize: 14, fontWeight: "bold", color: "#fff" },
  linkHint: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 12,
    lineHeight: 18,
  },
  personalInfoSection: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  userInfoDisplay: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  userInfoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  userInfoText: { fontSize: 14, color: "#fff", fontWeight: "500" },
  reserveButton: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  reserveButtonDisabled: { opacity: 0.5 },
  reserveButtonText: { fontSize: 16, fontWeight: "bold", color: "#fff", letterSpacing: 1 },
});
