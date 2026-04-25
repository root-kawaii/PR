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
import { Event, Table } from "@/types";
import { useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { trackEvent } from "@/config/analytics";
import { Alert } from "react-native";
import { TableReservationModal } from "./TableReservationModal";
import { ThemePalette } from "@/constants/theme";

type EventDetailModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onReserveTable: (table: Table) => void;
};

export const EventDetailModal = ({
  visible,
  event,
  onClose,
  onReserveTable,
}: EventDetailModalProps) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [showTableReservation, setShowTableReservation] = useState(false);

  // Reset table reservation modal when main modal closes
  useEffect(() => {
    if (!visible) {
      setShowTableReservation(false);
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

  const handleBuyTicket = () => {
    if (!event) return;

    if (!user) {
      trackEvent("reserve_table_login_required", {
        event_id: event.id,
        event_title: event.title,
      });
      Alert.alert("Accesso richiesto", "Effettua il login per prenotare un tavolo.", [
        { text: "OK" },
      ]);
      return;
    }

    trackEvent("reserve_table_tapped", {
      event_id: event.id,
      event_title: event.title,
    });

    setShowTableReservation(true);
  };

  if (!event) return null;

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
                <View style={[styles.eventTag, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}35` }]}>
                  <IconSymbol name="wineglass.fill" size={12} color={theme.primary} />
                  <ThemedText style={[styles.eventTagText, { color: theme.primary }]}>Esperienza serale</ThemedText>
                </View>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{event.title}</ThemedText>
                <View style={styles.modalDateRow}>
                  <IconSymbol name="calendar" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.modalDate, { color: theme.textSecondary }]}>{event.date}</ThemedText>
                </View>
                {event.venue ? (
                  <View style={styles.modalDateRow}>
                    <IconSymbol name="mappin" size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.modalDate, { color: theme.textSecondary }]}>{event.venue}</ThemedText>
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
              <View style={[styles.priceBox, { backgroundColor: theme.backgroundElevated }]}>
                <ThemedText style={[styles.priceLabel, { color: theme.textTertiary }]}>Ingresso</ThemedText>
                <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                  {event.price || "32 €"}
                </ThemedText>
              </View>

              <TouchableOpacity onPress={handleBuyTicket} activeOpacity={0.8}>
                <LinearGradient
                  colors={theme.gradientPrimary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.buyButton, { shadowColor: theme.primary }]}
                >
                  <IconSymbol name="calendar" size={20} color={theme.textInverse} />
                  <ThemedText style={[styles.buyButtonText, { color: theme.textInverse }]}>
                    Prenota Tavolo
                  </ThemedText>
                </LinearGradient>
              </TouchableOpacity>
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
  eventTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
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
  eventTagText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
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
