// ====================================
// components/event/EventDetailModal.tsx
// ====================================
import {
  Modal,
  ScrollView,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Event, Table, TableReservation } from "@/types";
import { useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { trackEvent } from "@/config/analytics";
import { Alert } from "react-native";
import { TableReservationModal } from "./TableReservationModal";
import { TicketPurchaseModal } from "./TicketPurchaseModal";
import { ThemePalette } from "@/constants/theme";
import {
  formatEventDateTimeLabel,
  hasEventReservableAreas,
  getEventAddressLabel,
  getEventPriceLabel,
  getEventVenueLabel,
  isEventFreeEntry,
  resolveEventEntryType,
  resolveEventTicketingMode,
} from "@/utils/eventDisplay";

type EventDetailModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onReserveTable: (table: Table) => void;
  onReservationCreated?: (reservation: TableReservation) => void;
};

export const EventDetailModal = ({
  visible,
  event,
  onClose,
  onReserveTable,
  onReservationCreated,
}: EventDetailModalProps) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [showTableReservation, setShowTableReservation] = useState(false);
  const [showTicketPurchase, setShowTicketPurchase] = useState(false);

  // Reset table reservation modal when main modal closes
  useEffect(() => {
    if (!visible) {
      setShowTableReservation(false);
      setShowTicketPurchase(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !event) {
      return;
    }

    trackEvent("event_detail_opened", {
      event_id: event.id,
      event_title: event.title,
      venue: event.venue ?? '',
    });
  }, [event?.id, visible]);

  const requireUser = (action: "ticket" | "reservation") => {
    if (!event) return;

    if (!user) {
      trackEvent(action === "ticket" ? "ticket_purchase_login_required" : "reserve_table_login_required", {
        event_id: event.id,
        event_title: event.title,
      });
      Alert.alert("Accesso richiesto", action === "ticket"
        ? "Effettua il login per acquistare un biglietto."
        : "Effettua il login per prenotare un tavolo.", [
        { text: "OK" },
      ]);
      return false;
    }

    return true;
  };

  const handleReserveArea = () => {
    if (!event || !requireUser("reservation")) return;

    trackEvent("reserve_table_tapped", {
      event_id: event.id,
      event_title: event.title,
    });

    setShowTableReservation(true);
  };

  const handleBuyTicket = () => {
    if (!event || !requireUser("ticket")) return;

    trackEvent("ticket_purchase_tapped", {
      event_id: event.id,
      event_title: event.title,
    });

    setShowTicketPurchase(true);
  };

  if (!event) return null;

  const venueLabel = getEventVenueLabel(event);
  const addressLabel = getEventAddressLabel(event);
  const entryPriceLabel = getEventPriceLabel(event);
  const hasFreeEntry = isEventFreeEntry(event);
  const entryType = resolveEventEntryType(event);
  const ticketingMode = resolveEventTicketingMode(event);
  const hasReservableAreas = hasEventReservableAreas(event);
  const showTicketCta = ticketingMode !== "none";
  const showReservationCta = hasReservableAreas;
  const showFreeEntryInfo =
    entryType === "free" && ticketingMode === "none" && !showReservationCta;
  const showReservationNotice = showReservationCta;
  const reservationNoticeText =
    ticketingMode === "paid"
      ? "La quota area copre la tua parte del tavolo. Il ticket di ingresso si acquista separatamente."
      : ticketingMode === "free"
        ? "La quota area copre la tua parte del tavolo. Il ticket gratuito si ottiene separatamente."
        : "La prenotazione area copre la tua parte del tavolo per l'evento a ingresso libero.";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]} edges={["top"]}>
        <ThemedView style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.modalImageContainer, { backgroundColor: theme.backgroundSurface }]}>
              <Image
                source={{ uri: event.image }}
                style={styles.modalImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.25)", "rgba(8,8,8,0.95)"]}
                style={styles.modalImageOverlay}
              />
              <View style={styles.imageContent}>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{event.title}</ThemedText>
                <View style={styles.modalDateRow}>
                  <IconSymbol name="calendar" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.modalDate, { color: theme.textSecondary }]}>
                    {formatEventDateTimeLabel(event)}
                  </ThemedText>
                </View>
                {venueLabel ? (
                  <View style={styles.modalDateRow}>
                    <IconSymbol name="mappin" size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.modalDate, { color: theme.textSecondary }]}>
                      {venueLabel}
                    </ThemedText>
                  </View>
                ) : null}
                {addressLabel ? (
                  <View style={styles.modalDateRow}>
                    <IconSymbol name="location.fill" size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.modalDate, { color: theme.textSecondary }]}>
                      {addressLabel}
                    </ThemedText>
                  </View>
                ) : null}
                {event.genres && event.genres.length > 0 && (
                  <View style={styles.genreRow}>
                    {event.genres.map(g => (
                      <View key={g.id} style={[styles.genreBadge, { backgroundColor: g.color }]}>
                        <ThemedText style={styles.genreBadgeText}>{g.name}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.detailsContainer, { backgroundColor: theme.backgroundElevated }]}>
              <View style={styles.detailRow}>
                <DetailItem value={event.time || "23:00"} label="Inizio" theme={theme} />
                <DetailItem value={event.ageLimit || "18+"} label="Eta minima" theme={theme} />
                <DetailItem value={event.endTime || "04:00"} label="Fine" theme={theme} />
              </View>
            </View>

            <View style={styles.ctaSection}>
              {!hasFreeEntry && entryPriceLabel ? (
                <View style={[styles.priceBox, { backgroundColor: theme.backgroundElevated }]}>
                  <ThemedText style={[styles.priceLabel, { color: theme.textTertiary }]}>Ingresso evento</ThemedText>
                  <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                    {entryPriceLabel}
                  </ThemedText>
                </View>
              ) : null}

              {showTicketCta ? (
                <TouchableOpacity onPress={handleBuyTicket} activeOpacity={0.8}>
                  <LinearGradient
                    colors={theme.gradientPrimary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.buyButton, { shadowColor: theme.primary }]}
                  >
                    <IconSymbol name="ticket.fill" size={20} color={theme.textInverse} />
                    <ThemedText style={[styles.buyButtonText, { color: theme.textInverse }]}>
                      {ticketingMode === "free" ? "Ottieni ticket" : "Acquista biglietto"}
                    </ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}

              {showReservationCta ? (
                <TouchableOpacity
                  onPress={handleReserveArea}
                  activeOpacity={0.85}
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
                  ]}
                >
                  <IconSymbol name="table.furniture" size={18} color={theme.text} />
                  <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
                    Prenota area
                  </ThemedText>
                </TouchableOpacity>
              ) : null}

              {showReservationNotice ? (
                <View style={[styles.infoNotice, { backgroundColor: theme.backgroundElevated }]}>
                  <ThemedText style={[styles.infoNoticeTitle, { color: theme.text }]}>
                    Cosa include la prenotazione
                  </ThemedText>
                  <ThemedText style={[styles.infoNoticeText, { color: theme.textTertiary }]}>
                    {reservationNoticeText}
                  </ThemedText>
                </View>
              ) : null}

              {showFreeEntryInfo ? (
                <View style={[styles.infoNotice, { backgroundColor: theme.backgroundElevated }]}>
                  <ThemedText style={[styles.infoNoticeTitle, { color: theme.text }]}>
                    Ingresso libero
                  </ThemedText>
                  <ThemedText style={[styles.infoNoticeText, { color: theme.textTertiary }]}>
                    Questo evento non richiede acquisto ticket e non ha aree prenotabili disponibili.
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {event.description && (
              <View style={[styles.descriptionSection, { backgroundColor: theme.backgroundElevated }]}>
                <ThemedText style={[styles.descriptionTitle, { color: theme.text }]}>
                  Dettagli Evento
                </ThemedText>
                <ThemedText style={[styles.descriptionText, { color: theme.textTertiary }]}>
                  {event.description}
                </ThemedText>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </ThemedView>
      </SafeAreaView>

      <TableReservationModal
        visible={showTableReservation}
        event={event}
        onClose={() => setShowTableReservation(false)}
        onReserveTable={onReserveTable}
        onReservationCreated={(reservation) => {
          setShowTableReservation(false);
          onClose();
          onReservationCreated?.(reservation);
        }}
      />

      <TicketPurchaseModal
        visible={showTicketPurchase}
        event={event}
        onClose={() => setShowTicketPurchase(false)}
        onPurchaseCompleted={() => {
          setShowTicketPurchase(false);
          onClose();
        }}
      />
    </Modal>
  );
};

const DetailItem = ({ value, label, theme }: { value: string; label: string; theme: ThemePalette }) => (
  <View style={styles.detailBox}>
    <ThemedText style={[styles.detailValue, { color: theme.text }]}>{value}</ThemedText>
    <ThemedText style={[styles.detailLabel, { color: theme.textTertiary }]}>{label}</ThemedText>
  </View>
);

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "#000" },
  modalContent: { flex: 1, backgroundColor: "#000" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImageContainer: {
    width: "100%",
    height: 400,
    backgroundColor: "#1f2937",
    position: "relative",
  },
  modalImage: { width: "100%", height: "100%" },
  modalImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    gap: 8,
  },
  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  genreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  genreBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalTitle: { fontSize: 30, fontWeight: "bold", marginBottom: 4, lineHeight: 34 },
  modalDateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalDate: { fontSize: 14, color: "#9ca3af" },
  detailsContainer: {
    backgroundColor: "#111",
    padding: 20,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 16,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailBox: { flex: 1, alignItems: "center", gap: 8 },
  detailValue: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  detailLabel: { fontSize: 11, color: "#6b7280", textAlign: "center" },
  ctaSection: { marginHorizontal: 16, marginTop: 24, gap: 16 },
  priceBox: {
    backgroundColor: "#111",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    minHeight: 90,
    justifyContent: "center",
  },
  priceLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 6 },
  priceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  buyButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#ec4899",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buyButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  secondaryButton: {
    paddingVertical: 17,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  infoNotice: {
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  infoNoticeTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  infoNoticeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  descriptionSection: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    backgroundColor: "#111",
    borderRadius: 16,
  },
  descriptionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  descriptionText: { fontSize: 14, color: "#9ca3af", lineHeight: 22 },
});
