import {
  Modal,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Event, Table } from "@/types";
import { useState, useEffect, useRef } from "react";
import { WebView } from "react-native-webview";
import { API_URL } from "@/config/api";
import { TableReservationModal as PaymentModal } from "@/components/reservation/TableReservationModal";

type TableReservationModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onReserveTable: (table: Table) => void;
};

export const TableReservationModal = ({
  visible,
  event,
  onClose,
  onReserveTable,
}: TableReservationModalProps) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const [matterportLoaded, setMatterportLoaded] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch tables when modal opens
  useEffect(() => {
    if (visible && event) {
      fetchTables();
      setMatterportLoaded(false);
    } else {
      // Reset payment modal state when main modal closes
      setShowPaymentModal(false);
      setSelectedTable(null);
    }
  }, [visible, event]);

  const fetchTables = async () => {
    if (!event) return;

    setLoadingTables(true);
    try {
      const url = `${API_URL}/tables/event/${event.id}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch tables");
      }

      const data = await response.json();
      console.log("Fetched tables:", data);
      // API returns {tables: [...]} so we need to extract the array
      setTables(data.tables || data);
    } catch (error) {
      console.error("Error fetching tables:", error);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  console.log("Tables state:", tables, "Loading:", loadingTables);

  if (!event) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <ThemedView style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Event Info Summary */}
            <View style={styles.eventSummary}>
              <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
              <ThemedText style={styles.eventDate}>{event.date}</ThemedText>
            </View>

            {/* Matterport 3D Venue Tour */}
            {event.matterportId && (
              <View style={styles.matterportSection}>
                <ThemedText style={styles.matterportTitle}>
                  Explore the Venue in 3D
                </ThemedText>
                <View style={styles.matterportContainer}>
                  <WebView
                    ref={webViewRef}
                    source={{
                      uri: `https://my.matterport.com/show/?m=${event.matterportId}&play=1&qs=1&help=0`,
                    }}
                    style={styles.matterportWebview}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    onLoad={() => setMatterportLoaded(true)}
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
              </View>
            )}

            {/* All Tables List (below Matterport) */}
            {tables && Array.isArray(tables) && tables.length > 0 && (
              <View style={styles.allTablesSection}>
                <ThemedText style={styles.allTablesSectionTitle}>
                  All Tables
                </ThemedText>
                {tables.map((table) => (
                  <TouchableOpacity
                    key={table.id}
                    style={[
                      styles.tableCard,
                      !table.available && styles.tableCardUnavailable,
                    ]}
                    onPress={() => {
                      if (table.available) {
                        setSelectedTable(table);
                        setShowPaymentModal(true);
                      }
                    }}
                    activeOpacity={table.available ? 0.7 : 1}
                    disabled={!table.available}
                  >
                    <View style={styles.tableCardHeader}>
                      <ThemedText style={styles.tableCardName}>
                        {table.name}
                      </ThemedText>
                      <View style={styles.tableCardHeaderRight}>
                        {table.zone && (
                          <ThemedText style={styles.tableCardZone}>
                            {table.zone}
                          </ThemedText>
                        )}
                        {!table.available && (
                          <ThemedText style={styles.unavailableBadge}>
                            Unavailable
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    <View style={styles.tableCardInfo}>
                      <View style={styles.tableCardInfoItem}>
                        <IconSymbol name="person" size={14} color="#9ca3af" />
                        <ThemedText style={styles.tableCardInfoText}>
                          {table.capacity} seats
                        </ThemedText>
                      </View>
                      <View style={styles.tableCardInfoItem}>
                        <IconSymbol name="eurosign" size={14} color="#9ca3af" />
                        <ThemedText style={styles.tableCardInfoText}>
                          Min {table.minSpend}
                        </ThemedText>
                      </View>
                    </View>
                    {table.locationDescription && (
                      <ThemedText style={styles.tableCardLocation}>
                        📍 {table.locationDescription}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Floating Back Button */}
          <TouchableOpacity onPress={onClose} style={styles.floatingBackButton}>
            <IconSymbol name="chevron.left" size={24} color="#fff" />
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>

      {/* Payment Modal */}
      <PaymentModal
        visible={showPaymentModal}
        table={selectedTable}
        event={event}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedTable(null);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backButton: {
    paddingTop: 40,
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  eventSummary: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  eventTitle: {
    paddingTop: 0,
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: "#9ca3af",
  },
  tablesSection: {
    padding: 20,
  },
  tablesSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#fff",
  },
  tableCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  tableCardZone: {
    fontSize: 12,
    color: "#ec4899",
    backgroundColor: "#2a1520",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tableCardInfo: {
    flexDirection: "row",
    gap: 16,
  },
  tableCardInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tableCardInfoText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  tableCardLocation: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 8,
  },
  matterportSection: {
    padding: 20,
  },
  matterportTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#fff",
  },
  matterportContainer: {
    height: 400,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  matterportWebview: {
    flex: 1,
  },
  matterportLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  matterportLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9ca3af",
  },
  allTablesSection: {
    padding: 20,
    paddingTop: 0,
  },
  allTablesSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 20,
    color: "#fff",
  },
  tableCardUnavailable: {
    opacity: 0.5,
    borderColor: "#3a3a3a",
  },
  tableCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unavailableBadge: {
    fontSize: 11,
    color: "#6b7280",
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  floatingBackButton: {
    position: "absolute",
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
