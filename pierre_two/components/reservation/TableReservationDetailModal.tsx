import { useState, useEffect } from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/context/ThemeContext";
import { TableReservation, PaymentShare } from "@/types";
import { API_URL } from "@/config/api";

type TableReservationDetailModalProps = {
  visible: boolean;
  reservation: TableReservation | null;
  onClose: () => void;
  onPaymentSubmit: (numPeople: number) => Promise<void>;
};

export const TableReservationDetailModal = ({
  visible,
  reservation,
  onClose,
}: TableReservationDetailModalProps) => {
  const { theme } = useTheme();
  const [paymentShares, setPaymentShares] = useState<PaymentShare[]>([]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [slotsFilled, setSlotsFilled] = useState(0);
  const [slotsTotal, setSlotsTotal] = useState(0);

  useEffect(() => {
    if (visible && reservation?.id) {
      fetchPaymentStatus();
    }
  }, [visible, reservation?.id]);

  if (!reservation) return null;

  const totalAmount = parseFloat(reservation.totalAmount.replace(/[^0-9.]/g, ""));
  const amountPaid = parseFloat(reservation.amountPaid.replace(/[^0-9.]/g, ""));

  const fetchPaymentStatus = async () => {
    try {
      const response = await fetch(
        `${API_URL}/reservations/${reservation!.id}/payment-status`
      );
      if (response.ok) {
        const data = await response.json();
        setPaymentShares(data.paymentShares || []);
        setShareLink(data.shareLink || null);
        setSlotsFilled(data.slotsFilled ?? 0);
        setSlotsTotal(data.slotsTotal ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch payment status:", error);
    }
  };

  const handleShareTableLink = async () => {
    if (!shareLink) return;
    try {
      await Share.share({
        message: `Unisciti al mio tavolo "${reservation.table?.name || ""}"! Paga la tua quota qui: ${shareLink}`,
        url: shareLink,
      });
    } catch (_) {}
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "paid":
        return theme.success;
      case "pending":
      case "checkout_pending":
        return theme.warning;
      case "completed":
        return theme.info;
      case "cancelled":
      case "expired":
        return theme.error;
      default:
        return theme.textTertiary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed": return "Confermata";
      case "pending": return "In attesa";
      case "checkout_pending": return "In pagamento";
      case "paid": return "Pagato";
      case "completed": return "Completata";
      case "cancelled": return "Cancellata";
      case "expired": return "Scaduto";
      default: return status;
    }
  };

  const paidShares = paymentShares.filter((s) => s.status === "paid");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.backgroundSurface }]}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={theme.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
              Dettagli Prenotazione
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Event Image & Info */}
            {reservation.event && (
              <View style={styles.eventSection}>
                <Image source={{ uri: reservation.event.image }} style={styles.eventImage} />
                <View style={styles.eventOverlay} />
                <View style={styles.eventInfo}>
                  <ThemedText style={[styles.eventTitle, { color: theme.text }]}>
                    {reservation.event.title}
                  </ThemedText>
                  <View style={styles.eventMeta}>
                    <IconSymbol name="mappin" size={14} color={theme.textTertiary} />
                    <ThemedText style={styles.eventVenue}>{reservation.event.venue}</ThemedText>
                  </View>
                  <View style={styles.eventMeta}>
                    <IconSymbol name="calendar" size={14} color={theme.textTertiary} />
                    <ThemedText style={styles.eventDate}>{reservation.event.date}</ThemedText>
                  </View>
                </View>
              </View>
            )}

            {/* Reservation Code & Status */}
            <View style={styles.section}>
              <View style={styles.codeStatusRow}>
                <View style={styles.codeContainer}>
                  <ThemedText style={[styles.label, { color: theme.textTertiary }]}>
                    Codice Prenotazione
                  </ThemedText>
                  <ThemedText style={[styles.reservationCode, { color: theme.text }]}>
                    {reservation.reservationCode}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(reservation.status) }]}>
                  <ThemedText style={[styles.statusText, { color: theme.textInverse }]}>
                    {getStatusText(reservation.status)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Share Link Button */}
            {shareLink && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={[styles.shareLinkCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.primary }]}
                  onPress={handleShareTableLink}
                >
                  <View style={styles.shareLinkLeft}>
                    <IconSymbol name="arrow.right.square.fill" size={22} color={theme.primary} />
                    <View>
                      <ThemedText style={[styles.shareLinkTitle, { color: theme.text }]}>
                        Condividi Link Tavolo
                      </ThemedText>
                      <ThemedText style={[styles.shareLinkSub, { color: theme.textTertiary }]}>
                        {slotsFilled}/{slotsTotal} posti occupati
                      </ThemedText>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Table Info */}
            {reservation.table && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Informazioni Tavolo
                </ThemedText>
                <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                  <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                    <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Tavolo</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {reservation.table.name}
                    </ThemedText>
                  </View>
                  {reservation.table.zone && (
                    <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                      <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Zona</ThemedText>
                      <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                        {reservation.table.zone}
                      </ThemedText>
                    </View>
                  )}
                  <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                    <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Capacità</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {reservation.table.capacity} persone
                    </ThemedText>
                  </View>
                  {reservation.table.locationDescription && (
                    <View style={[styles.locationContainer, { borderTopColor: theme.border }]}>
                      <IconSymbol name="location.fill" size={16} color={theme.textTertiary} />
                      <ThemedText style={[styles.locationText, { color: theme.textTertiary }]}>
                        {reservation.table.locationDescription}
                      </ThemedText>
                    </View>
                  )}
                  {reservation.table.features && reservation.table.features.length > 0 && (
                    <View style={[styles.featuresContainer, { borderTopColor: theme.border }]}>
                      {reservation.table.features.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                          <IconSymbol name="checkmark.circle" size={14} color={theme.success} />
                          <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>
                            {feature}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Payment Shares */}
            {paymentShares.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                  Quote ({paidShares.length}/{paymentShares.length} pagate)
                </ThemedText>
                <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                  {paymentShares.map((share) => (
                    <View key={share.id} style={[styles.shareRow, { borderBottomColor: theme.border }]}>
                      <View style={[
                        styles.shareIcon,
                        { backgroundColor: share.isOwner ? `${theme.primary}1A` : `${getStatusColor(share.status)}1A` }
                      ]}>
                        <IconSymbol
                          name={share.isOwner ? "heart.fill" : "person"}
                          size={18}
                          color={share.isOwner ? theme.primary : getStatusColor(share.status)}
                        />
                      </View>
                      <View style={styles.shareInfo}>
                        <ThemedText style={[styles.shareName, { color: theme.text }]}>
                          {share.isOwner
                            ? "Tu (Proprietario)"
                            : share.guestName || share.phoneNumber || "Ospite"}
                        </ThemedText>
                        <View style={styles.shareStatusRow}>
                          <View style={[
                            styles.shareStatusBadge,
                            { backgroundColor: `${getStatusColor(share.status)}33` }
                          ]}>
                            <ThemedText style={[styles.shareStatusText, { color: getStatusColor(share.status) }]}>
                              {getStatusText(share.status)}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.shareAmount, { color: theme.text }]}>
                            {share.amount}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Reservation Details */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Dettagli Prenotazione
              </ThemedText>
              <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                  <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Nome contatto</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>{reservation.contactName}</ThemedText>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                  <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Email</ThemedText>
                  <ThemedText style={[styles.infoValueSmall, { color: theme.text }]}>{reservation.contactEmail}</ThemedText>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                  <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Telefono</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>{reservation.contactPhone}</ThemedText>
                </View>
                {reservation.specialRequests && (
                  <View style={[styles.specialRequestsContainer, { borderTopColor: theme.border }]}>
                    <ThemedText style={[styles.infoLabel, { color: theme.textTertiary }]}>Richieste speciali</ThemedText>
                    <ThemedText style={[styles.specialRequestsText, { color: theme.textSecondary }]}>
                      {reservation.specialRequests}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>

            {/* Payment Summary */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Riepilogo Pagamento
              </ThemedText>
              <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <View style={styles.paymentRow}>
                  <ThemedText style={[styles.paymentLabel, { color: theme.textTertiary }]}>Importo totale</ThemedText>
                  <ThemedText style={[styles.paymentValue, { color: theme.text }]}>{reservation.totalAmount}</ThemedText>
                </View>
                <View style={styles.paymentRow}>
                  <ThemedText style={[styles.paymentLabel, { color: theme.textTertiary }]}>Già pagato</ThemedText>
                  <ThemedText style={[styles.paymentValue, { color: theme.success }]}>{reservation.amountPaid}</ThemedText>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.paymentRow}>
                  <ThemedText style={[styles.paymentLabelTotal, { color: theme.text }]}>Rimanente</ThemedText>
                  <ThemedText style={[styles.paymentValueTotal, { color: theme.primary }]}>{reservation.amountRemaining}</ThemedText>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${totalAmount > 0 ? Math.min((amountPaid / totalAmount) * 100, 100) : 0}%`,
                          backgroundColor: theme.success,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.progressText, { color: theme.textTertiary }]}>
                    {totalAmount > 0 ? Math.round((amountPaid / totalAmount) * 100) : 0}% pagato
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  scrollView: { flex: 1 },
  eventSection: { position: "relative", height: 250 },
  eventImage: { width: "100%", height: "100%" },
  eventOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  eventInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20 },
  eventTitle: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 4 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  eventVenue: { fontSize: 14, color: "rgba(255, 255, 255, 0.9)" },
  eventDate: { fontSize: 14, color: "rgba(255, 255, 255, 0.9)" },
  section: { paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 12 },
  codeStatusRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", gap: 12,
  },
  codeContainer: { flex: 1 },
  label: { fontSize: 13, color: "#9ca3af", marginBottom: 1, fontWeight: "500" },
  reservationCode: { fontSize: 20, fontWeight: "700", color: "#fff", letterSpacing: 1 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#fff", textTransform: "uppercase" },
  shareLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  shareLinkLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  shareLinkTitle: { fontSize: 15, fontWeight: "700" },
  shareLinkSub: { fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#2a2a2a",
  },
  infoLabel: { fontSize: 14, color: "#9ca3af", fontWeight: "500" },
  infoValue: { fontSize: 14, color: "#fff", fontWeight: "600" },
  infoValueSmall: { fontSize: 12, color: "#fff", fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  locationContainer: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#2a2a2a",
  },
  locationText: { fontSize: 13, color: "#9ca3af", flex: 1 },
  featuresContainer: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#2a2a2a", gap: 8,
  },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: "#d1d5db" },
  specialRequestsContainer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#2a2a2a" },
  specialRequestsText: { fontSize: 13, color: "#d1d5db", marginTop: 6, lineHeight: 18 },
  shareRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#2a2a2a",
  },
  shareIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  shareInfo: { flex: 1 },
  shareName: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 4 },
  shareStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  shareStatusText: { fontSize: 11, fontWeight: "600" },
  shareAmount: { fontSize: 14, fontWeight: "600", color: "#fff" },
  paymentRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8,
  },
  paymentLabel: { fontSize: 14, color: "#9ca3af" },
  paymentValue: { fontSize: 16, color: "#fff", fontWeight: "600" },
  paymentLabelTotal: { fontSize: 16, color: "#fff", fontWeight: "700" },
  paymentValueTotal: { fontSize: 20, color: "#ec4899", fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#2a2a2a", marginVertical: 8 },
  progressContainer: { marginTop: 16 },
  progressBar: { height: 8, backgroundColor: "#2a2a2a", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#10b981", borderRadius: 4 },
  progressText: { fontSize: 12, color: "#9ca3af", marginTop: 6, textAlign: "center" },
});
