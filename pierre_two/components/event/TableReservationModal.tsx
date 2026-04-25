import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Event, Table } from "@/types";
import { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/config/api";
import { useTheme } from "@/context/ThemeContext";
import { TableReservationModal as PaymentModal } from "@/components/reservation/TableReservationModal";
import { MarzipanoViewer, MarzipanoViewerRef } from "@/components/event/MarzipanoViewer";
import { TableFilterMenu } from "@/components/event/TableFilterMenu";

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
}: TableReservationModalProps) => {
  const { theme } = useTheme();
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedTables, setHasFetchedTables] = useState(false);
  const marzipanoViewerRef = useRef<MarzipanoViewerRef>(null);
  const [currentSceneName, setCurrentSceneName] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [filteredTableIds, setFilteredTableIds] = useState<string[]>([]);

  // Fetch tables when modal opens
  useEffect(() => {
    if (visible && event) {
      setHasFetchedTables(false);
      fetchTables();
      // Set initial scene name if available
      if (event.marzipanoScenes && event.marzipanoScenes.length > 0) {
        setCurrentSceneName(event.marzipanoScenes[0].name);
      }
    } else {
      // Reset state when main modal closes
      setShowPaymentModal(false);
      setSelectedTable(null);
      setCurrentSceneName("");
      setMenuVisible(false);
      setHasFetchedTables(false);
    }
  }, [visible, event]);

  const fetchTables = async () => {
    if (!event) return;

    setIsLoading(true);
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
      setIsLoading(false);
      setHasFetchedTables(true);
    }
  };

  // Handle table click from Marzipano viewer (hotspot)
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

  // Handle table selection from filter menu
  const handleTableSelectFromMenu = (table: Table) => {
    console.log(`📍 Navigating to table: ${table.name}`);

    // If table has marzipano position, switch to that scene
    if (table.marzipanoPosition?.sceneId) {
      marzipanoViewerRef.current?.switchScene(table.marzipanoPosition.sceneId);
    }

    // Open payment modal for the selected table
    setSelectedTable(table);
    setShowPaymentModal(true);
  };

  // Handle scene change from Marzipano viewer
  const handleSceneChange = (_sceneId: string, sceneName: string) => {
    console.log(`🔄 Scene changed to: ${sceneName}`);
    setCurrentSceneName(sceneName);
  };

  // Handle filter changes from menu - update hotspot visibility
  const handleFilterChange = useCallback((tableIds: string[]) => {
    setFilteredTableIds(tableIds);
    marzipanoViewerRef.current?.updateHotspotVisibility(tableIds);
  }, []);

  if (!event) return null;

  // Check if event has Marzipano configuration
  const hasMarzipanoTour = event.marzipanoScenes && event.marzipanoScenes.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Fullscreen Marzipano 360° Viewer */}
        {hasMarzipanoTour && hasFetchedTables ? (
          <MarzipanoViewer
            ref={marzipanoViewerRef}
            scenes={event.marzipanoScenes!}
            tables={tables}
            onTableClick={handleTableClick}
            onSceneChange={handleSceneChange}
            style={styles.fullscreenViewer}
          />
        ) : hasMarzipanoTour ? (
          <View style={[styles.loadingTourContainer, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingTourText, { color: theme.text }]}>
              Caricamento tavoli del tour 360...
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.noTourContainer, { backgroundColor: theme.background }]}>
            <ThemedText style={styles.noTourIcon}>🏛️</ThemedText>
            <ThemedText style={[styles.noTourText, { color: theme.text }]}>
              360° venue tour not available
            </ThemedText>
          </View>
        )}

        {/* Scene Indicator Overlay */}
        {currentSceneName && (
          <View style={[styles.sceneIndicator, { backgroundColor: theme.overlay }]}>
            <ThemedText style={[styles.sceneText, { color: theme.text }]}>
              📍 {currentSceneName}
            </ThemedText>
          </View>
        )}

        {/* Floating Back Button */}
        <TouchableOpacity onPress={onClose} style={[styles.backButton, { backgroundColor: theme.overlay }]}>
          <IconSymbol name="chevron.left" size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Floating Menu (Hamburger) Button */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={[styles.menuButton, { backgroundColor: theme.overlay }]}
        >
          <View style={styles.hamburgerIcon}>
            <View style={[styles.hamburgerLine, { backgroundColor: theme.text }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: theme.text }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: theme.text }]} />
          </View>
        </TouchableOpacity>

        {/* Table Filter Menu Overlay */}
        <TableFilterMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          tables={tables}
          onTableSelect={handleTableSelectFromMenu}
          selectedTableId={selectedTable?.id}
          onFilterChange={handleFilterChange}
        />
      </ThemedView>

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
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  fullscreenViewer: {
    flex: 1,
  },
  noTourContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  loadingTourContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0a0a0a",
  },
  loadingTourText: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  noTourIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noTourText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  sceneIndicator: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 50,
  },
  sceneText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
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
  menuButton: {
    position: "absolute",
    top: 60,
    left: 76,
    width: 48,
    height: 48,
    borderRadius: 24,
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
  hamburgerIcon: {
    width: 20,
    height: 14,
    justifyContent: "space-between",
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    backgroundColor: "#fff",
    borderRadius: 1,
  },
});
