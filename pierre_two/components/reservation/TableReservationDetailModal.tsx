// ====================================
// components/reservation/TableReservationDetailModal.tsx
// ====================================
import { useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TableReservation } from "@/types";

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
  onPaymentSubmit,
}: TableReservationDetailModalProps) => {
  const [numPeople, setNumPeople] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!reservation) return null;

  const minSpendPerPerson = parseFloat(
    reservation.table?.minSpend?.replace(" €", "") || "0"
  );
  const totalAmount = parseFloat(reservation.totalAmount.replace(" €", ""));
  const amountPaid = parseFloat(reservation.amountPaid.replace(" €", ""));
  const amountRemaining = parseFloat(
    reservation.amountRemaining.replace(" €", "")
  );
  const contributionAmount = minSpendPerPerson * numPeople;

  const handlePayment = async () => {
    setLoading(true);
    try {
      await onPaymentSubmit(numPeople);
      setNumPeople(1);
    } catch (error) {
      console.error("Payment failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const incrementPeople = () => {
    if (numPeople < reservation.numPeople) {
      setNumPeople(numPeople + 1);
    }
  };

  const decrementPeople = () => {
    if (numPeople > 1) {
      setNumPeople(numPeople - 1);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "completed":
        return "#3b82f6";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "Confermata";
      case "pending":
        return "In attesa";
      case "completed":
        return "Completata";
      case "cancelled":
        return "Cancellata";
      default:
        return status;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>
              Dettagli Prenotazione
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Event Image & Info */}
            {reservation.event && (
              <View style={styles.eventSection}>
                <Image
                  source={{ uri: reservation.event.image }}
                  style={styles.eventImage}
                />
                <View style={styles.eventOverlay} />
                <View style={styles.eventInfo}>
                  <ThemedText style={styles.eventTitle}>
                    {reservation.event.title}
                  </ThemedText>
                  <View style={styles.eventMeta}>
                    <IconSymbol name="mappin" size={14} color="#9ca3af" />
                    <ThemedText style={styles.eventVenue}>
                      {reservation.event.venue}
                    </ThemedText>
                  </View>
                  <View style={styles.eventMeta}>
                    <IconSymbol name="calendar" size={14} color="#9ca3af" />
                    <ThemedText style={styles.eventDate}>
                      {reservation.event.date}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}

            {/* Reservation Code & Status */}
            <View style={styles.section}>
              <View style={styles.codeStatusRow}>
                <View style={styles.codeContainer}>
                  <ThemedText style={styles.label}>
                    Codice Prenotazione
                  </ThemedText>
                  <ThemedText style={styles.reservationCode}>
                    {reservation.reservationCode}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(reservation.status) },
                  ]}
                >
                  <ThemedText style={styles.statusText}>
                    {getStatusText(reservation.status)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Table Info */}
            {reservation.table && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Informazioni Tavolo
                </ThemedText>
                <View style={styles.card}>
                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Tavolo</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {reservation.table.name}
                    </ThemedText>
                  </View>
                  {reservation.table.zone && (
                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>Zona</ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {reservation.table.zone}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Capacità</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {reservation.table.capacity} persone
                    </ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>
                      Min. a persona
                    </ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {reservation.table.minSpend}
                    </ThemedText>
                  </View>
                  {reservation.table.locationDescription && (
                    <View style={styles.locationContainer}>
                      <IconSymbol name="location" size={16} color="#9ca3af" />
                      <ThemedText style={styles.locationText}>
                        {reservation.table.locationDescription}
                      </ThemedText>
                    </View>
                  )}
                  {reservation.table.features &&
                    reservation.table.features.length > 0 && (
                      <View style={styles.featuresContainer}>
                        {reservation.table.features.map((feature, index) => (
                          <View key={index} style={styles.featureItem}>
                            <IconSymbol
                              name="checkmark.circle"
                              size={14}
                              color="#10b981"
                            />
                            <ThemedText style={styles.featureText}>
                              {feature}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                </View>
              </View>
            )}

            {/* Reservation Details */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Dettagli Prenotazione
              </ThemedText>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>
                    Numero persone
                  </ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {reservation.numPeople}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>
                    Nome contatto
                  </ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {reservation.contactName}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Email</ThemedText>
                  <ThemedText style={styles.infoValueSmall}>
                    {reservation.contactEmail}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Telefono</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {reservation.contactPhone}
                  </ThemedText>
                </View>
                {reservation.specialRequests && (
                  <View style={styles.specialRequestsContainer}>
                    <ThemedText style={styles.infoLabel}>
                      Richieste speciali
                    </ThemedText>
                    <ThemedText style={styles.specialRequestsText}>
                      {reservation.specialRequests}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>

            {/* Payment Summary */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Riepilogo Pagamento
              </ThemedText>
              <View style={styles.card}>
                <View style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>
                    Importo totale
                  </ThemedText>
                  <ThemedText style={styles.paymentValue}>
                    {reservation.totalAmount}
                  </ThemedText>
                </View>
                <View style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>
                    Già pagato
                  </ThemedText>
                  <ThemedText
                    style={[styles.paymentValue, { color: "#10b981" }]}
                  >
                    {reservation.amountPaid}
                  </ThemedText>
                </View>
                <View style={styles.divider} />
                <View style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabelTotal}>
                    Rimanente
                  </ThemedText>
                  <ThemedText style={styles.paymentValueTotal}>
                    {reservation.amountRemaining}
                  </ThemedText>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(amountPaid / totalAmount) * 100}%` },
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.progressText}>
                    {Math.round((amountPaid / totalAmount) * 100)}% pagato
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Payment Contribution */}
            {amountRemaining > 0 && reservation.status !== "cancelled" && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Contribuisci al Pagamento
                </ThemedText>
                <View style={styles.card}>
                  <ThemedText style={styles.contributionDescription}>
                    Seleziona per quante persone vuoi pagare la quota minima di{" "}
                    {reservation.table?.minSpend} a persona.
                  </ThemedText>

                  {/* People Counter */}
                  <View style={styles.counterContainer}>
                    <ThemedText style={styles.counterLabel}>
                      Numero di persone
                    </ThemedText>
                    <View style={styles.counter}>
                      <TouchableOpacity
                        style={[
                          styles.counterButton,
                          numPeople <= 1 && styles.counterButtonDisabled,
                        ]}
                        onPress={decrementPeople}
                        disabled={numPeople <= 1}
                      >
                        <IconSymbol
                          name="minus"
                          size={20}
                          color={numPeople <= 1 ? "#6b7280" : "#fff"}
                        />
                      </TouchableOpacity>
                      <View style={styles.counterValueContainer}>
                        <ThemedText style={styles.counterValue}>
                          {numPeople}
                        </ThemedText>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.counterButton,
                          numPeople >= reservation.numPeople &&
                            styles.counterButtonDisabled,
                        ]}
                        onPress={incrementPeople}
                        disabled={numPeople >= reservation.numPeople}
                      >
                        <IconSymbol
                          name="plus"
                          size={20}
                          color={
                            numPeople >= reservation.numPeople
                              ? "#6b7280"
                              : "#fff"
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Contribution Amount */}
                  <View style={styles.contributionAmountContainer}>
                    <ThemedText style={styles.contributionAmountLabel}>
                      Importo da pagare
                    </ThemedText>
                    <ThemedText style={styles.contributionAmount}>
                      {contributionAmount.toFixed(2)} €
                    </ThemedText>
                  </View>

                  {/* Pay Button */}
                  <TouchableOpacity
                    style={[
                      styles.payButton,
                      loading && styles.payButtonDisabled,
                    ]}
                    onPress={handlePayment}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.payButtonText}>
                        Paga {contributionAmount.toFixed(2)} €
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Spacing at bottom */}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  eventSection: {
    position: "relative",
    height: 250,
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  eventOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  eventInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  eventDate: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  codeStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  codeContainer: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 1,
    fontWeight: "500",
  },
  reservationCode: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  infoLabel: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  infoValueSmall: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  locationText: {
    fontSize: 13,
    color: "#9ca3af",
    flex: 1,
  },
  featuresContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: "#d1d5db",
  },
  specialRequestsContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  specialRequestsText: {
    fontSize: 13,
    color: "#d1d5db",
    marginTop: 6,
    lineHeight: 18,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  paymentValue: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  paymentLabelTotal: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "700",
  },
  paymentValueTotal: {
    fontSize: 20,
    color: "#ec4899",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginVertical: 8,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#2a2a2a",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 6,
    textAlign: "center",
  },
  contributionDescription: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 20,
  },
  counterContainer: {
    marginBottom: 20,
  },
  counterLabel: {
    fontSize: 10,
    color: "#9ca3af",
    marginBottom: 12,
    fontWeight: "500",
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  counterButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2a2a2a",
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonDisabled: {
    opacity: 0.4,
  },
  counterValueContainer: {
    minWidth: 60,
    alignItems: "center",
  },
  counterValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  contributionAmountContainer: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contributionAmountLabel: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  contributionAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ec4899",
  },
  payButton: {
    backgroundColor: "#ec4899",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
