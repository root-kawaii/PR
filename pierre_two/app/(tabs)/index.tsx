import { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import WebView from "react-native-webview";
import { ThemedView } from "@/components/themed-view";
import { SearchBar } from "@/components/home/SearchBar";
import { SectionHeader } from "@/components/home/SectionHeader";
import { EventCard } from "@/components/home/EventCard";
import { ClubCard } from "@/components/home/ClubCard";
import { GenreCard } from "@/components/home/GenreCard";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { TableReservationModal } from "@/components/reservation/TableReservationModal";
import { FloatingActionButton } from "@/components/common/FloatingActionButton";
import { ReservationCodeModal } from "@/components/reservation/ReservationCodeModal";
import { TableReservationDetailModal } from "@/components/reservation/TableReservationDetailModal";
import { useEvents } from "@/hooks/useEvents";
import { useGenres } from "@/hooks/useGenres";
import { useClubs } from "@/hooks/useClubs";
import { useModal } from "@/hooks/useModal";
import { Event, Table, TableReservation } from "@/types";
import { useLocalSearchParams } from "expo-router";

// Helper function to get API URL
const getApiUrl = () => {
  const isDevice = Constants.isDevice;
  const isSimulator =
    Constants.deviceName?.includes("Simulator") ||
    Constants.deviceName?.includes("Emulator");

  if (isSimulator === true) {
    if (Platform.OS === "android") return "http://10.0.2.2:3000";
    return "http://127.0.0.1:3000";
  }
  if (isDevice === true || (isDevice !== false && !isSimulator)) {
    return "http://172.20.10.5:3000";
  }
  return "http://127.0.0.1:3000";
};

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<TableReservation | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { events, refetch: refetchEvents } = useEvents();
  const { genres, refetch: refetchGenres } = useGenres();
  const { clubs, refetch: refetchClubs } = useClubs();
  const eventModal = useModal();
  const reservationModal = useModal();
  const codeInputModal = useModal();
  const reservationDetailModal = useModal();
  const params = useLocalSearchParams();

  // Handle navigation from search page
  useEffect(() => {
    if (params.eventId && events.length > 0) {
      const event = events.find((e) => e.id === params.eventId);
      if (event) {
        handleEventPress(event);
      }
    }
  }, [params.eventId, events]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchEvents(true), // Silent refetch
      refetchGenres(true),
      refetchClubs(true),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
    eventModal.open();
  };

  const handleReserveTable = (table?: Table) => {
    // If a table is passed, use it; otherwise use first available table
    const tableToReserve = table || selectedEvent?.tables?.[0] || null;
    setSelectedTable(tableToReserve);
    eventModal.close();
    reservationModal.open();
  };

  const handleFABPress = () => {
    codeInputModal.open();
  };

  const handleReservationCodeSubmit = async (code: string) => {
    const API_URL = getApiUrl();

    try {
      const response = await fetch(`${API_URL}/reservations/code/${code}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Prenotazione non trovata");
        }
        throw new Error("Errore durante il recupero della prenotazione");
      }

      const data = await response.json();
      setSelectedReservation(data);
      codeInputModal.close();
      reservationDetailModal.open();
    } catch (error: any) {
      throw error;
    }
  };

  const handlePaymentSubmit = async (numPeople: number) => {
    if (!selectedReservation) return;

    const minSpendPerPerson = parseFloat(
      selectedReservation.table?.minSpend?.replace(" €", "") || "0"
    );
    const amount = minSpendPerPerson * numPeople;

    // TODO: Implement actual payment flow
    // For now, just show a success message
    Alert.alert(
      "Pagamento Simulato",
      `Pagamento di ${amount.toFixed(2)} € per ${numPeople} ${
        numPeople === 1 ? "persona" : "persone"
      } simulato con successo.\n\nIn produzione, qui verrebbe integrato il sistema di pagamento.`,
      [
        {
          text: "OK",
          onPress: () => {
            reservationDetailModal.close();
            setSelectedReservation(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ThemedView style={styles.container}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#db2777"
              colors={["#db2777"]}
              progressViewOffset={60}
            />
          }
        >
          <View style={styles.section}>
            <SectionHeader
              icon="calendar"
              title="Questa settimana"
              iconColor="#ef4444"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => handleEventPress(event)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <SectionHeader
              icon="cube"
              title="Virtual Tour 3D"
              iconColor="#3b82f6"
            />
            <View style={styles.matterportContainer}>
              <WebView
                source={{
                  uri: "https://my.matterport.com/show/?m=pnPefxvh4dB&play=1&qs=1&brand=0&help=0&title=0&dh=0&gt=0&hr=0&mls=1&sdk=1&vr=0&f=1",
                }}
                style={styles.matterportView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                startInLoadingState={true}
              />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader icon="" title="Clubs con eventi in programma" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {clubs.map((club, index) => (
                <ClubCard key={club.id} club={club} index={index} />
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <SectionHeader
              icon="music.note"
              title="Generi musicali"
              iconColor="#10b981"
            />
            <View style={styles.genreGrid}>
              {genres.map((genre) => (
                <GenreCard key={genre.id} genre={genre} />
              ))}
            </View>
          </View>
        </ScrollView>
      </ThemedView>

      <EventDetailModal
        visible={eventModal.isVisible}
        event={selectedEvent}
        onClose={eventModal.close}
        onReserveTable={handleReserveTable}
      />

      <TableReservationModal
        visible={reservationModal.isVisible}
        table={selectedTable}
        event={selectedEvent}
        onClose={reservationModal.close}
      />

      <FloatingActionButton onPress={handleFABPress} icon="qrcode" />

      <ReservationCodeModal
        visible={codeInputModal.isVisible}
        onClose={codeInputModal.close}
        onSubmit={handleReservationCodeSubmit}
      />

      <TableReservationDetailModal
        visible={reservationDetailModal.isVisible}
        reservation={selectedReservation}
        onClose={reservationDetailModal.close}
        onPaymentSubmit={handlePaymentSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
  section: { paddingHorizontal: 10, paddingVertical: 16 },
  grid: { flexDirection: "row", gap: 12 },
  genreGrid: { flexDirection: "row", gap: 12 },
  matterportContainer: {
    height: 300,
    borderRadius: 12,
    // overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  matterportView: {
    flex: 1,
  },
});
