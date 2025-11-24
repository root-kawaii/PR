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
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Event, Table } from "@/types";
import { useState, useEffect } from "react";
import Constants from "expo-constants";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { Alert } from "react-native";

// Platform-aware API URL (same logic as useGenres/useClubs)
const getApiUrl = () => {
  const isDevice = Constants.isDevice;
  const isSimulator =
    Constants.deviceName?.includes("Simulator") ||
    Constants.deviceName?.includes("Emulator");

  if (isSimulator === true) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000";
    }
    return "http://127.0.0.1:3000";
  }

  if (isDevice === true || (isDevice !== false && !isSimulator)) {
    return "http://172.20.10.5:3000";
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }
  return "http://127.0.0.1:3000";
};

const API_URL = getApiUrl();

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
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const { user } = useAuth();

  // Fetch tables when event changes
  useEffect(() => {
    if (visible && event) {
      fetchTables();
    }
  }, [visible, event]);

  const fetchTables = async () => {
    if (!event) return;

    setLoadingTables(true);
    try {
      const url = `${API_URL}/tables/event/${event.id}`;
      const response = await fetch(url);

      if (!response.ok) {
        setTables([]);
        return;
      }

      const responseText = await response.text();
      if (responseText.trim().length === 0) {
        setTables([]);
        return;
      }

      const data = JSON.parse(responseText);
      setTables(data.tables || []);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleBuyTicket = () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to reserve a table",
        [{ text: "OK" }]
      );
      return;
    }

    if (!event) return;

    // Check if there are available tables
    const availableTables = tables.filter((t) => t.available);

    if (availableTables.length === 0) {
      Alert.alert(
        "No Tables Available",
        "Sorry, there are no available tables for this event at the moment.",
        [{ text: "OK" }]
      );
      return;
    }

    // Open table reservation with the first available table
    onReserveTable(availableTables[0]);
  };

  if (!event) return null;

  const availableTables = tables.filter((t) => t.available);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <ThemedView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalImageContainer}>
              <Image
                source={{ uri: event.image }}
                style={styles.modalImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.modalTitleSection}>
              <ThemedText style={styles.modalTitle}>{event.title}</ThemedText>
              <View style={styles.modalDateRow}>
                <IconSymbol name="calendar" size={16} color="#e5e7eb" />
                <ThemedText style={styles.modalDate}>{event.date}</ThemedText>
              </View>
              <View style={styles.modalDateRow}>
                <IconSymbol name="mappin" size={16} color="#e5e7eb" />
                <ThemedText style={styles.modalDate}>{event.venue}</ThemedText>
              </View>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <DetailItem value={event.time || "23:00"} label="Start Time" />
                <DetailItem value={event.ageLimit || "18+"} label="Age Limit" />
                <DetailItem value={event.endTime || "04:00"} label="End Time" />
              </View>
            </View>

            <View style={styles.ctaSection}>
              <View style={styles.priceBox}>
                <ThemedText style={styles.priceLabel}>Entry Fee</ThemedText>
                <ThemedText style={styles.priceValue}>
                  {event.price || "32 €"}
                </ThemedText>
              </View>

              <TouchableOpacity
                onPress={handleBuyTicket}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#ec4899', '#db2777']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buyButton}
                >
                  <IconSymbol name="calendar" size={20} color="#fff" />
                  <ThemedText style={styles.buyButtonText}>Reserve Table</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Available Tables Section */}
            {loadingTables ? (
              <View style={styles.tablesSection}>
                <ActivityIndicator size="small" color="#ec4899" />
                <ThemedText style={styles.tablesSectionTitle}>
                  Loading tables...
                </ThemedText>
              </View>
            ) : availableTables.length > 0 ? (
              <View style={styles.tablesSection}>
                <ThemedText style={styles.tablesSectionTitle}>
                  Available Tables
                </ThemedText>
                {availableTables.map((table) => (
                  <TouchableOpacity
                    key={table.id}
                    style={styles.tableCard}
                    onPress={() => onReserveTable(table)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tableCardHeader}>
                      <ThemedText style={styles.tableCardName}>
                        {table.name}
                      </ThemedText>
                      {table.zone && (
                        <ThemedText style={styles.tableCardZone}>
                          {table.zone}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.tableCardInfo}>
                      <View style={styles.tableCardInfoItem}>
                        <IconSymbol name="person" size={14} color="#9ca3af" />
                        <ThemedText style={styles.tableCardInfoText}>
                          Max {table.capacity} people
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.tableCardPrice}>
                        {table.minSpend}/person
                      </ThemedText>
                    </View>
                    {table.locationDescription && (
                      <ThemedText style={styles.tableCardDescription}>
                        {table.locationDescription}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Matterport 3D Venue Tour */}
            {event.matterportId && (
              <View style={styles.matterportSection}>
                <ThemedText style={styles.matterportTitle}>
                  Explore the Venue in 3D
                </ThemedText>
                <View style={styles.matterportContainer}>
                  <WebView
                    source={{
                      uri: `https://my.matterport.com/show/?m=${event.matterportId}&play=1&qs=1&help=0&sdk=1`,
                    }}
                    style={styles.matterportWebview}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    renderLoading={() => (
                      <View style={styles.matterportLoading}>
                        <ActivityIndicator size="large" color="#ec4899" />
                        <ThemedText style={styles.matterportLoadingText}>
                          Loading 3D tour...
                        </ThemedText>
                      </View>
                    )}
                  />
                </View>
                <TouchableOpacity
                  style={styles.matterportButton}
                  onPress={() =>
                    Linking.openURL(
                      `https://my.matterport.com/show/?m=${event.matterportId}&play=1&qs=1&help=0&sdk=1`
                    )
                  }
                >
                  <IconSymbol
                    name="arrow.up.right.square"
                    size={18}
                    color="#fff"
                  />
                  <ThemedText style={styles.matterportButtonText}>
                    Open in full screen
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {event.description && (
              <View style={styles.descriptionSection}>
                <ThemedText style={styles.descriptionTitle}>
                  About Event
                </ThemedText>
                <ThemedText style={styles.descriptionText}>
                  {event.description}
                </ThemedText>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
};

const DetailItem = ({ value, label }: { value: string; label: string }) => (
  <View style={styles.detailBox}>
    <ThemedText style={styles.detailValue}>{value}</ThemedText>
    <ThemedText style={styles.detailLabel}>{label}</ThemedText>
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
  shareButton: {
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
  },
  modalImage: { width: "100%", height: "100%" },
  modalTitleSection: { padding: 36, backgroundColor: "#000", gap: 8 },
  modalTitle: { fontSize: 26, fontWeight: "bold", marginBottom: 8 },
  modalDateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalDate: { fontSize: 14, color: "#9ca3af" },
  detailsContainer: {
    backgroundColor: "#111",
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
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
  tablesSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  tablesSectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#fff",
  },
  tableCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  tableCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tableCardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  tableCardZone: {
    fontSize: 12,
    color: "#ec4899",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tableCardInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tableCardInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tableCardInfoText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  tableCardPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fbbf24",
  },
  tableCardDescription: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
  },
  matterportSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  matterportTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#fff",
  },
  matterportContainer: {
    height: 400,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    marginBottom: 12,
  },
  matterportWebview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  matterportLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  matterportLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9ca3af",
  },
  matterportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#374151",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  matterportButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
