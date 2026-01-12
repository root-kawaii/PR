import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Event, Table } from "@/types";
import { useState, useEffect, useRef } from "react";
import { API_URL } from "@/config/api";
import { TableReservationModal as PaymentModal } from "@/components/reservation/TableReservationModal";
import { MarzipanoViewer, MarzipanoViewerRef } from "@/components/event/MarzipanoViewer";

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
  const marzipanoViewerRef = useRef<MarzipanoViewerRef>(null);
  const [currentSceneName, setCurrentSceneName] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch tables when modal opens
  useEffect(() => {
    if (visible && event) {
      fetchTables();
      // Set initial scene name if available
      if (event.marzipanoScenes && event.marzipanoScenes.length > 0) {
        setCurrentSceneName(event.marzipanoScenes[0].name);
      }
    } else {
      // Reset payment modal state when main modal closes
      setShowPaymentModal(false);
      setSelectedTable(null);
      setCurrentSceneName("");
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
      console.log(`Fetched ${data.tables?.length || 0} tables for event`);
      // API returns {tables: [...]} so we need to extract the array
      setTables(data.tables || data);
    } catch (error) {
      console.error("Error fetching tables:", error);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  // Handle table click from Marzipano viewer
  const handleTableClick = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (table && table.available) {
      console.log(`✅ Opening payment modal for table: ${table.name}`);
      setSelectedTable(table);
      setShowPaymentModal(true);
    } else if (table && !table.available) {
      console.log(`⚠️ Table ${table.name} is not available`);
    }
  };

  // Handle scene change from Marzipano viewer
  const handleSceneChange = (sceneId: string, sceneName: string) => {
    console.log(`🔄 Scene changed to: ${sceneName}`);
    setCurrentSceneName(sceneName);
  };

  if (!event) return null;

  // Check if event has Marzipano configuration
  const hasMarzipanoTour = event.marzipanoScenes && event.marzipanoScenes.length > 0;

  if (!hasMarzipanoTour) {
    console.warn(`⚠️ No Marzipano scenes configured for event: ${event.title}`);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <ThemedView style={styles.modalContent}>
          {/* Event Info Summary */}
          <View style={styles.eventSummary}>
            <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
            <ThemedText style={styles.eventDate}>{event.date}</ThemedText>
          </View>

            {/* Marzipano 360° Venue Tour */}
            {hasMarzipanoTour ? (
              <View style={styles.marzipanoSection}>
                <View style={styles.viewerHeader}>
                  <View>
                    <ThemedText style={styles.viewerTitle}>
                      Explore the Venue
                    </ThemedText>
                    <ThemedText style={styles.viewerSubtitle}>
                      Click on table markers to reserve
                    </ThemedText>
                  </View>
                  {currentSceneName && (
                    <View style={styles.sceneIndicator}>
                      <ThemedText style={styles.sceneText}>
                        📍 {currentSceneName}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.viewerContainer}>
                  <MarzipanoViewer
                    ref={marzipanoViewerRef}
                    scenes={event.marzipanoScenes!}
                    tables={tables}
                    onTableClick={handleTableClick}
                    onSceneChange={handleSceneChange}
                    style={styles.viewer}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.noTourContainer}>
                <ThemedText style={styles.noTourIcon}>🏛️</ThemedText>
                <ThemedText style={styles.noTourText}>
                  360° venue tour not available
                </ThemedText>
                <ThemedText style={styles.noTourSubtext}>
                  Scroll down to view available tables
                </ThemedText>
              </View>
            )}

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
  marzipanoSection: {
    flex: 1,
    padding: 20,
  },
  viewerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  viewerSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
  },
  sceneIndicator: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sceneText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  viewerContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  viewer: {
    flex: 1,
  },
  noTourContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  noTourIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noTourText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  noTourSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
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
