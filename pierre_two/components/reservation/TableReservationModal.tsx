import { useState, useEffect } from "react";
import {
  Modal,
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Table, Event } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/context/ThemeContext";
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

  // Paying guests (people who will each pay their share)
  const [payingGuestPhones, setPayingGuestPhones] = useState<string[]>([]);
  const [newPayingPhone, setNewPayingPhone] = useState("");

  // Free guests (added without payment)
  const [freeGuestPhones, setFreeGuestPhones] = useState<string[]>([]);
  const [newFreePhone, setNewFreePhone] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && table) {
      setPayingGuestPhones([]);
      setNewPayingPhone("");
      setFreeGuestPhones([]);
      setNewFreePhone("");
    }
  }, [visible, table]);

  if (!table || !event) {
    return null;
  }

  // Fixed total cost from the table
  const tableTotalCost = parseFloat(
    (table.totalCost || "0").replace(/[^0-9.]/g, "")
  );

  // Number of paying people = owner + paying guests
  const numPayingGuests = 1 + payingGuestPhones.length;

  // Per-person amount (for display)
  const perPersonAmount = tableTotalCost / numPayingGuests;

  // Owner pays the remainder to handle rounding
  const guestShare = Math.floor(perPersonAmount * 100) / 100;
  const ownerShare =
    Math.round(
      (tableTotalCost - guestShare * payingGuestPhones.length) * 100
    ) / 100;

  // Total people at the table
  const totalPeople = numPayingGuests + freeGuestPhones.length;
  const canAddMore = totalPeople < table.capacity;

  const handleReservation = async () => {
    if (!user) {
      Alert.alert("Errore", "Devi effettuare il login per prenotare un tavolo");
      return;
    }

    if (totalPeople > table.capacity) {
      Alert.alert(
        "Capacità superata",
        `Il tavolo ha una capacità massima di ${table.capacity} persone.`
      );
      return;
    }

    setLoading(true);

    try {
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
            num_paying_guests: numPayingGuests,
            guest_phone_numbers: payingGuestPhones,
            contact_name: user.name,
            contact_email: user.email,
            contact_phone: user.phone_number || "",
            special_requests: null,
          }),
        }
      );

      if (!paymentIntentResponse.ok) {
        const errorText = await paymentIntentResponse.text();
        throw new Error(`Failed to create payment intent: ${errorText}`);
      }

      const paymentIntentData = await paymentIntentResponse.json();

      // Step 2: Initialize and present Stripe payment sheet (owner's share only)
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentData.clientSecret,
        merchantDisplayName: "Pierre Two",
        returnURL: "pierre-two://stripe-redirect",
      });

      if (initError) {
        Alert.alert(
          "Errore",
          "Impossibile inizializzare il pagamento. Riprova."
        );
        setLoading(false);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Errore", "Pagamento non riuscito. Riprova.");
        }
        setLoading(false);
        return;
      }

      // Step 3: Create reservation with split payment
      const reservationResponse = await fetch(
        `${API_URL}/reservations/create-with-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table_id: table.id,
            event_id: event.id,
            owner_user_id: user.id,
            paying_guest_phone_numbers: payingGuestPhones,
            free_guest_phone_numbers:
              freeGuestPhones.length > 0 ? freeGuestPhones : null,
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
        throw new Error(`Failed to create reservation: ${errorText}`);
      }

      const data = await reservationResponse.json();

      // Build share links for paying guests
      const pendingShares = (data.paymentShares || []).filter(
        (s: any) => !s.isOwner && s.paymentLinkToken
      );

      if (pendingShares.length > 0) {
        const shareLinks = pendingShares
          .map(
            (s: any) =>
              `${s.phoneNumber || "Ospite"}: ${s.amount}`
          )
          .join("\n");

        Alert.alert(
          "Prenotazione Confermata!",
          `Codice: ${data.reservation.reservationCode}\nLa tua quota: €${ownerShare.toFixed(2)}\n\nLink di pagamento generati per:\n${shareLinks}\n\nCondividi i link dalla schermata prenotazioni.`,
          [
            {
              text: "OK",
              onPress: () => onClose(),
            },
          ]
        );
      } else {
        Alert.alert(
          "Prenotazione Confermata!",
          `Codice: ${data.reservation.reservationCode}\nTotale pagato: €${ownerShare.toFixed(2)}`,
          [
            {
              text: "OK",
              onPress: () => onClose(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Reservation error:", error);
      Alert.alert(
        "Errore",
        "Non è stato possibile completare la prenotazione. Riprova più tardi."
      );
    } finally {
      setLoading(false);
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
            <ThemedText style={styles.headerTitle}>
              Paga la Tua Quota
            </ThemedText>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                {/* Table Info Card */}
                <View style={styles.tableInfoCard}>
                  <View style={styles.locationRow}>
                    <IconSymbol name="location.fill" size={16} color="#fff" />
                    <ThemedText style={styles.tableName}>
                      {table.name} - {table.zone || "Molto"}
                    </ThemedText>
                  </View>

                  <View style={styles.eventInfo}>
                    <ThemedText style={styles.eventTitle}>
                      {event.title}
                    </ThemedText>
                    <ThemedText style={styles.eventVenue}>
                      {event.venue}
                    </ThemedText>
                    <ThemedText style={styles.eventDate}>
                      {event.date}
                    </ThemedText>
                  </View>

                  {/* Characteristics */}
                  <View style={styles.characteristicsSection}>
                    <ThemedText style={styles.sectionTitle}>
                      Caratteristiche Tavolo:
                    </ThemedText>
                    {table.features?.map((feature, index) => (
                      <View key={index} style={styles.featureRow}>
                        <ThemedText style={styles.bulletPoint}>•</ThemedText>
                        <ThemedText style={styles.featureText}>
                          {feature}
                        </ThemedText>
                      </View>
                    ))}
                    {table.locationDescription && (
                      <View style={styles.featureRow}>
                        <ThemedText style={styles.bulletPoint}>•</ThemedText>
                        <ThemedText style={styles.featureText}>
                          {table.locationDescription}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                {/* Paying Guests Section */}
                <View style={styles.spendSection}>
                  <ThemedText style={styles.spendTitle}>
                    Ospiti Paganti
                  </ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>
                    Aggiungi i numeri di telefono delle persone che pagheranno la
                    loro quota. Riceveranno un link di pagamento.
                  </ThemedText>

                  <View style={styles.guestPhoneInputRow}>
                    <TextInput
                      style={[styles.input, styles.guestPhoneInput]}
                      placeholder="+39 123 456 7890"
                      placeholderTextColor="#9ca3af"
                      value={newPayingPhone}
                      onChangeText={setNewPayingPhone}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addGuestButton,
                        (!newPayingPhone.trim() || !canAddMore) &&
                          styles.addGuestButtonDisabled,
                      ]}
                      onPress={() => {
                        if (newPayingPhone.trim() && canAddMore) {
                          setPayingGuestPhones([
                            ...payingGuestPhones,
                            newPayingPhone.trim(),
                          ]);
                          setNewPayingPhone("");
                        }
                      }}
                      disabled={!newPayingPhone.trim() || !canAddMore}
                    >
                      <IconSymbol
                        name="plus.circle.fill"
                        size={24}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>

                  {payingGuestPhones.length > 0 && (
                    <View style={styles.guestList}>
                      <ThemedText style={styles.guestListTitle}>
                        Ospiti paganti ({payingGuestPhones.length}):
                      </ThemedText>
                      {payingGuestPhones.map((phone, index) => (
                        <View key={index} style={styles.guestItem}>
                          <IconSymbol
                            name="eurosign"
                            size={16}
                            color="#fbbf24"
                          />
                          <ThemedText style={styles.guestPhone}>
                            {phone}
                          </ThemedText>
                          <ThemedText style={styles.guestShareAmount}>
                            €{guestShare.toFixed(2)}
                          </ThemedText>
                          <TouchableOpacity
                            onPress={() => {
                              setPayingGuestPhones(
                                payingGuestPhones.filter((_, i) => i !== index)
                              );
                            }}
                            style={styles.removeGuestButton}
                          >
                            <IconSymbol
                              name="xmark"
                              size={20}
                              color="#ef4444"
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Free Guests Section */}
                <View style={styles.spendSection}>
                  <ThemedText style={styles.spendTitle}>
                    Ospiti Gratuiti
                  </ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>
                    Aggiungi persone che parteciperanno senza pagare. Potrai
                    aggiungerne anche dopo la prenotazione.
                  </ThemedText>

                  <View style={styles.guestPhoneInputRow}>
                    <TextInput
                      style={[styles.input, styles.guestPhoneInput]}
                      placeholder="+39 123 456 7890"
                      placeholderTextColor="#9ca3af"
                      value={newFreePhone}
                      onChangeText={setNewFreePhone}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addGuestButton,
                        styles.addFreeGuestButton,
                        (!newFreePhone.trim() || !canAddMore) &&
                          styles.addGuestButtonDisabled,
                      ]}
                      onPress={() => {
                        if (newFreePhone.trim() && canAddMore) {
                          setFreeGuestPhones([
                            ...freeGuestPhones,
                            newFreePhone.trim(),
                          ]);
                          setNewFreePhone("");
                        }
                      }}
                      disabled={!newFreePhone.trim() || !canAddMore}
                    >
                      <IconSymbol
                        name="plus.circle.fill"
                        size={24}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>

                  {freeGuestPhones.length > 0 && (
                    <View style={styles.guestList}>
                      <ThemedText style={styles.guestListTitle}>
                        Ospiti gratuiti ({freeGuestPhones.length}):
                      </ThemedText>
                      {freeGuestPhones.map((phone, index) => (
                        <View key={index} style={styles.guestItem}>
                          <IconSymbol
                            name="person.3.fill"
                            size={16}
                            color="#22c55e"
                          />
                          <ThemedText style={styles.guestPhone}>
                            {phone}
                          </ThemedText>
                          <ThemedText style={styles.freeLabel}>
                            Gratis
                          </ThemedText>
                          <TouchableOpacity
                            onPress={() => {
                              setFreeGuestPhones(
                                freeGuestPhones.filter((_, i) => i !== index)
                              );
                            }}
                            style={styles.removeGuestButton}
                          >
                            <IconSymbol
                              name="xmark"
                              size={20}
                              color="#ef4444"
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Payment Summary */}
                <View style={styles.spendSection}>
                  <ThemedText style={styles.spendTitle}>Riepilogo</ThemedText>

                  <View style={styles.infoBox}>
                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>
                        Costo tavolo:
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        €{tableTotalCost.toFixed(2)}
                      </ThemedText>
                    </View>

                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>
                        Persone paganti:
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {numPayingGuests} (tu + {payingGuestPhones.length}{" "}
                        {payingGuestPhones.length === 1 ? "ospite" : "ospiti"})
                      </ThemedText>
                    </View>

                    {freeGuestPhones.length > 0 && (
                      <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>
                          Ospiti gratuiti:
                        </ThemedText>
                        <ThemedText style={styles.infoValue}>
                          {freeGuestPhones.length}
                        </ThemedText>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>
                        Totale persone:
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {totalPeople}/{table.capacity}
                      </ThemedText>
                    </View>

                    {payingGuestPhones.length > 0 && (
                      <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>
                          Quota per ospite:
                        </ThemedText>
                        <ThemedText style={styles.infoValue}>
                          €{guestShare.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}

                    <View style={[styles.infoRow, styles.totalRow]}>
                      <ThemedText style={styles.totalLabel}>
                        La tua quota:
                      </ThemedText>
                      <ThemedText
                        style={[styles.infoValue, styles.highlightValue]}
                      >
                        €{ownerShare.toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                {/* Your Info */}
                <View style={styles.personalInfoSection}>
                  <ThemedText style={styles.sectionTitle}>
                    Le Tue Informazioni
                  </ThemedText>
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
                  style={[
                    styles.reserveButton,
                    loading && styles.reserveButtonDisabled,
                  ]}
                  onPress={handleReservation}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <IconSymbol
                        name="checkmark.circle"
                        size={20}
                        color="#fff"
                      />
                      <ThemedText style={styles.reserveButtonText}>
                        PAGA €{ownerShare.toFixed(2)} E PRENOTA
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </View>
            </TouchableWithoutFeedback>
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
    alignItems: "center",
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
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  scrollView: { flex: 1 },
  tableInfoCard: {
    margin: 16,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  tableName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  eventInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  characteristicsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    gap: 8,
  },
  bulletPoint: {
    color: "#fff",
    fontSize: 14,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
  },
  spendSection: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  spendTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  guestPhoneInputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  guestPhoneInput: {
    flex: 1,
  },
  addGuestButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(251, 191, 36, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  addFreeGuestButton: {
    backgroundColor: "rgba(34, 197, 94, 0.8)",
  },
  addGuestButtonDisabled: {
    opacity: 0.3,
  },
  guestList: {
    gap: 8,
  },
  guestListTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 8,
  },
  guestItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  guestPhone: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
  },
  guestShareAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fbbf24",
  },
  freeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22c55e",
  },
  removeGuestButton: {
    padding: 4,
  },
  infoBox: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  highlightValue: {
    fontSize: 20,
    color: "#fbbf24",
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
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
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userInfoText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
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
  reserveButtonDisabled: {
    opacity: 0.5,
  },
  reserveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
  },
});
