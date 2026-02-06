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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedView } from "@/components/themed-view";
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
  const [numPeople, setNumPeople] = useState(1);
  const [guestPhones, setGuestPhones] = useState<string[]>([]);
  const [newGuestPhone, setNewGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible && table) {
      setNumPeople(1);
      setGuestPhones([]);
      setNewGuestPhone("");
    }
  }, [visible, table]);

  // Return early if no table or event - don't render anything
  if (!table || !event) {
    return null;
  }

  // Calculate total cost - with safety checks
  const minSpendPerPerson = parseFloat(
    (table.minSpend || "0").replace(/[^0-9.]/g, "")
  );

  // Calculate total cost based on number of people
  const calculatedAmount = minSpendPerPerson * numPeople;
  const totalCost = calculatedAmount.toFixed(2);

  const minPeople = Math.ceil(
    parseFloat((table.totalCost || "0").replace(/[^0-9.]/g, "")) /
      minSpendPerPerson /
      2
  );
  const minTotalSpend = minSpendPerPerson * minPeople;

  const incrementPeople = () => {
    if (numPeople < table.capacity) {
      setNumPeople(numPeople + 1);
    }
  };

  const decrementPeople = () => {
    if (numPeople > 1) {
      setNumPeople(numPeople - 1);
    }
  };

  const handleReservation = async () => {
    // Validation
    if (!user) {
      Alert.alert("Errore", "Devi effettuare il login per prenotare un tavolo");
      return;
    }

    const amount = parseFloat(totalCost);
    if (amount < minTotalSpend) {
      Alert.alert(
        "Importo minimo richiesto",
        `Il tavolo richiede un minimo di €${minTotalSpend.toFixed(
          2
        )} (almeno ${minPeople} persone a €${minSpendPerPerson.toFixed(
          2
        )} ciascuna).`
      );
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create Stripe PaymentIntent
      console.log("Creating payment intent...");
      const paymentIntentResponse = await fetch(
        `${API_URL}/reservations/create-payment-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table_id: table.id,
            event_id: event.id,
            owner_user_id: user.id,
            guest_phone_numbers: guestPhones,
          }),
        }
      );

      if (!paymentIntentResponse.ok) {
        const errorText = await paymentIntentResponse.text();
        console.error("Payment intent error:", errorText);
        throw new Error(`Failed to create payment intent: ${errorText}`);
      }

      const paymentIntentData = await paymentIntentResponse.json();
      console.log("Payment intent created:", paymentIntentData.paymentIntentId);

      // Step 2: Initialize and present Stripe payment sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentData.clientSecret,
        merchantDisplayName: "Pierre Two",
        returnURL: "pierre-two://stripe-redirect",
      });

      if (initError) {
        console.error("Payment sheet init error:", initError);
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
          console.error("Payment sheet present error:", presentError);
          Alert.alert("Errore", "Pagamento non riuscito. Riprova.");
        }
        setLoading(false);
        return;
      }

      console.log("Payment successful");

      // Step 3: Create reservation with payment
      console.log("Creating reservation with payment...");
      const reservationResponse = await fetch(
        `${API_URL}/reservations/create-with-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table_id: table.id,
            event_id: event.id,
            owner_user_id: user.id,
            guest_phone_numbers: guestPhones,
            payment_amount: amount,
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
        console.error("Reservation error:", errorText);
        throw new Error("Failed to create reservation");
      }

      const data = await reservationResponse.json();
      console.log("Reservation created:", data);

      Alert.alert(
        "Prenotazione Confermata!",
        `Codice prenotazione: ${data.reservationCode}\nTotale: €${totalCost}`,
        [
          {
            text: "OK",
            onPress: () => onClose(),
          },
        ]
      );
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

                  {/* Event Info */}
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

                {/* Spend Selector */}
                <View style={styles.spendSection}>
                  <ThemedText style={styles.spendTitle}>
                    Quanto Vuoi Spendere?
                  </ThemedText>

                  {/* Number of people selector */}
                  <View style={styles.peopleSelectorContainer}>
                    <ThemedText style={styles.peopleSelectorLabel}>
                      Numero di persone
                    </ThemedText>
                    <View style={styles.peopleSelector}>
                      <TouchableOpacity
                        onPress={decrementPeople}
                        style={[
                          styles.peopleButton,
                          numPeople <= 1 && styles.peopleButtonDisabled,
                        ]}
                        disabled={numPeople <= 1}
                      >
                        <ThemedText style={styles.peopleButtonText}>
                          −
                        </ThemedText>
                      </TouchableOpacity>

                      <View style={styles.peopleDisplay}>
                        <ThemedText style={styles.peopleNumber}>
                          {numPeople}
                        </ThemedText>
                      </View>

                      <TouchableOpacity
                        onPress={incrementPeople}
                        style={[
                          styles.peopleButton,
                          numPeople >= table.capacity &&
                            styles.peopleButtonDisabled,
                        ]}
                        disabled={numPeople >= table.capacity}
                      >
                        <ThemedText style={styles.peopleButtonText}>
                          +
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Table Info Box */}
                  <View style={styles.infoBox}>
                    <ThemedText style={styles.infoTitle}>Riepilogo</ThemedText>

                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>Persone:</ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {numPeople}
                      </ThemedText>
                    </View>

                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>
                        Importo per persona:
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        €{(parseFloat(totalCost) / numPeople).toFixed(2)}
                      </ThemedText>
                    </View>

                    <View style={[styles.infoRow, styles.totalRow]}>
                      <ThemedText style={styles.totalLabel}>
                        Totale da pagare:
                      </ThemedText>
                      <ThemedText
                        style={[styles.infoValue, styles.highlightValue]}
                      >
                        €{totalCost}
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

                {/* Guest Phone Numbers */}
                <View style={styles.guestPhonesSection}>
                  <ThemedText style={styles.sectionTitle}>
                    Invita Ospiti
                  </ThemedText>
                  <ThemedText style={styles.guestPhonesSubtitle}>
                    Aggiungi i numeri di telefono degli ospiti che
                    condivideranno il tavolo. Puoi anche pagare per più persone
                    senza invitarle adesso.
                  </ThemedText>

                  {/* Guest Phone Input */}
                  <View style={styles.guestPhoneInputRow}>
                    <TextInput
                      style={[styles.input, styles.guestPhoneInput]}
                      placeholder="+39 123 456 7890"
                      placeholderTextColor="#9ca3af"
                      value={newGuestPhone}
                      onChangeText={setNewGuestPhone}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addGuestButton,
                        !newGuestPhone.trim() && styles.addGuestButtonDisabled,
                      ]}
                      onPress={() => {
                        if (newGuestPhone.trim()) {
                          setGuestPhones([
                            ...guestPhones,
                            newGuestPhone.trim(),
                          ]);
                          setNewGuestPhone("");
                        }
                      }}
                      disabled={!newGuestPhone.trim()}
                    >
                      <IconSymbol
                        name="plus.circle.fill"
                        size={24}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Guest List */}
                  {guestPhones.length > 0 && (
                    <View style={styles.guestList}>
                      <ThemedText style={styles.guestListTitle}>
                        Ospiti aggiunti ({guestPhones.length}):
                      </ThemedText>
                      {guestPhones.map((phone, index) => (
                        <View key={index} style={styles.guestItem}>
                          <IconSymbol
                            name="person.3.fill"
                            size={16}
                            color="#fff"
                          />
                          <ThemedText style={styles.guestPhone}>
                            {phone}
                          </ThemedText>
                          <TouchableOpacity
                            onPress={() => {
                              setGuestPhones(
                                guestPhones.filter((_, i) => i !== index)
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
                        UNISCITI AL TAVOLO
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
    marginBottom: 20,
  },
  peopleSelectorContainer: {
    marginBottom: 20,
  },
  peopleSelectorLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
    fontWeight: "600",
  },
  peopleSelector: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  peopleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  peopleButtonDisabled: {
    opacity: 0.3,
  },
  peopleButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  peopleDisplay: {
    minWidth: 80,
    height: 48,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  peopleNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  amountInputContainer: {
    marginBottom: 20,
  },
  amountInputLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
    fontWeight: "600",
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 16,
    height: 56,
  },
  euroPrefix: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    padding: 0,
  },
  minSpendText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
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
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
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
  fullWidthInput: {
    marginBottom: 12,
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
  requiredText: {
    fontSize: 11,
    color: "#fbbf24",
    marginTop: 8,
  },
  guestPhonesSection: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  guestPhonesSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 16,
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
    backgroundColor: "rgba(34, 197, 94, 0.8)",
    justifyContent: "center",
    alignItems: "center",
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
  removeGuestButton: {
    padding: 4,
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
