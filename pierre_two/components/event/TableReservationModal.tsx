import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Event, Table, TableReservation } from "@/types";
import { useState, useEffect, useRef } from "react";
import { API_URL } from "@/config/api";
import { useTheme } from "@/context/ThemeContext";
import { TableReservationModal as PaymentModal } from "@/components/reservation/TableReservationModal";
import { MarzipanoViewer, MarzipanoViewerRef } from "@/components/event/MarzipanoViewer";

type TableReservationModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onReserveTable: (table: Table) => void;
  onReservationCreated?: (reservation: TableReservation) => void;
};

export const TableReservationModal = ({
  visible,
  event,
  onClose,
  onReservationCreated,
}: TableReservationModalProps) => {
  const { theme } = useTheme();
  const [tables, setTables] = useState<Table[]>([]);
  const [hasFetchedTables, setHasFetchedTables] = useState(false);
  const marzipanoViewerRef = useRef<MarzipanoViewerRef>(null);
  const [currentSceneName, setCurrentSceneName] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch area-backed table inventory when modal opens.
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
      setSelectedAreaId(null);
      setCurrentSceneName("");
      setHasFetchedTables(false);
    }
  }, [visible, event]);

  const fetchTables = async () => {
    if (!event) return;

    try {
      const url = `${API_URL}/tables/event/${event.id}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch tables");
      }

      const data = await response.json();
      console.log(`Fetched ${data.tables?.length || 0} tables for event`);
      setTables(data.tables || data);
    } catch (error) {
      console.error("Error fetching tables:", error);
      setTables([]);
    } finally {
      setHasFetchedTables(true);
    }
  };

  // Area hotspot tapped: pass area_id to the BE so it auto-assigns the first
  // free table atomically. We still resolve a representative table from local
  // state purely to populate the PaymentModal display (price, capacity,
  // features, location) — its `id` is NOT used for the booking.
  const handleAreaClick = (areaId: string, areaName?: string) => {
    const representative = tables.find((t) => t.areaId === areaId && t.available);
    if (representative) {
      console.log(`✅ Opening payment modal for area: ${areaName ?? areaId}`);
      setSelectedTable(representative);
      setSelectedAreaId(areaId);
      setShowPaymentModal(true);
    } else {
      console.log(`⚠️ No available tables in area: ${areaName ?? areaId}`);
      Alert.alert(
        "Area non disponibile",
        `Non ci sono tavoli liberi nell'area "${areaName ?? "selezionata"}".`
      );
    }
  };

  // Handle scene change from Marzipano viewer
  const handleSceneChange = (_sceneId: string, sceneName: string) => {
    console.log(`🔄 Scene changed to: ${sceneName}`);
    setCurrentSceneName(sceneName);
  };

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
            onAreaClick={handleAreaClick}
            onSceneChange={handleSceneChange}
            style={styles.fullscreenViewer}
          />
        ) : hasMarzipanoTour ? (
          <View style={[styles.loadingTourContainer, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingTourText, { color: theme.text }]}>
              Caricamento aree del tour 360...
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.noTourContainer, { backgroundColor: theme.background }]}>
            <ThemedText style={styles.noTourIcon}>🏛️</ThemedText>
            <ThemedText style={[styles.noTourText, { color: theme.text }]}>
              Tour 360° non disponibile
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

      </ThemedView>

      {/* Payment Modal */}
      <PaymentModal
        visible={showPaymentModal}
        table={selectedTable}
        areaId={selectedAreaId ?? undefined}
        event={event}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedTable(null);
          setSelectedAreaId(null);
        }}
        onReservationCreated={(reservation) => {
          fetchTables();
          setShowPaymentModal(false);
          setSelectedTable(null);
          setSelectedAreaId(null);
          onClose();
          // Wait for THIS modal's dismiss animation before bubbling up —
          // see the comment in reservation/TableReservationModal.tsx.
          setTimeout(() => {
            if (reservation) {
              onReservationCreated?.(reservation);
            }
          }, 350);
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
});
