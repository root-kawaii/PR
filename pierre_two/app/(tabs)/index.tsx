import { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
  Text,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import Constants from "expo-constants";
import { ThemedView } from "@/components/themed-view";
import { SearchBar } from "@/components/home/SearchBar";
import { EventCard } from "@/components/home/EventCard";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { TableReservationModal } from "@/components/reservation/TableReservationModal";
import { FloatingActionButton } from "@/components/common/FloatingActionButton";
import { ReservationCodeModal } from "@/components/reservation/ReservationCodeModal";
import { TableReservationDetailModal } from "@/components/reservation/TableReservationDetailModal";
import { useEvents } from "@/hooks/useEvents";
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const { events, refetch: refetchEvents } = useEvents();
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
    await refetchEvents(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
    eventModal.open();
  };

  const handleReserveTable = (table?: Table) => {
    const tableToReserve = table || selectedEvent?.tables?.[0] || null;
    setSelectedTable(tableToReserve);
    eventModal.close();
    reservationModal.open();
  };

  const handleCalendarPress = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (day: any) => {
    setSelectedDate(new Date(day.dateString));
    setShowCalendar(false);
  };

  // Extract date portion from event date string
  const extractEventDate = (dateStr: string): string | null => {
    try {
      // Handle ISO format: '2024-12-27T23:00:00' or '2024-12-27'
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }

      // Handle date with space separator: '2024-12-27 23:00:00'
      if (dateStr.includes(' ') && !dateStr.includes('|')) {
        const datePart = dateStr.split(' ')[0];
        // Verify it's in YYYY-MM-DD format
        if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return datePart;
        }
      }

      // If already in YYYY-MM-DD format
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }

      // Handle Italian format: '15 GEN | 23:30' or '27 DIC'
      // This is a legacy format that should not be in the database
      // Just skip these events for now
      if (dateStr.match(/^\d{1,2}\s+[A-Z]{3}/)) {
        console.warn('Skipping event with legacy Italian date format:', dateStr);
        return null;
      }

      console.warn('Unexpected date format:', dateStr);
      return null;
    } catch (e) {
      console.error('Error extracting date:', dateStr, e);
      return null;
    }
  };

  // Group events by date
  const groupEventsByDate = (startDate: Date) => {
    const dateStr = startDate.toISOString().split("T")[0];

    // Filter events from selected date onwards
    const filteredEvents = events.filter((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return false;
      return eventDate >= dateStr;
    });

    // Group by date
    const grouped: { [key: string]: Event[] } = {};
    filteredEvents.forEach((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return;

      if (!grouped[eventDate]) {
        grouped[eventDate] = [];
      }
      grouped[eventDate].push(event);
    });

    // Sort dates and return array of {date, events}
    return Object.keys(grouped)
      .sort()
      .map((date) => ({
        date,
        events: grouped[date],
      }));
  };

  const formatDateHeader = (dateStr: string) => {
    const days = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
    const months = [
      "GEN",
      "FEB",
      "MAR",
      "APR",
      "MAG",
      "GIU",
      "LUG",
      "AGO",
      "SET",
      "OTT",
      "NOV",
      "DIC",
    ];

    try {
      // Parse date string manually to avoid timezone issues
      // dateStr format: 'YYYY-MM-DD'
      const parts = dateStr.split('-');
      if (parts.length !== 3) {
        throw new Error('Invalid date format');
      }

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error('Invalid date components');
      }

      const date = new Date(year, month - 1, day);

      const dayName = days[date.getDay()];
      const monthName = months[date.getMonth()];

      return `${dayName}, ${day} ${monthName}`;
    } catch (e) {
      console.error('Error formatting date header:', dateStr, e);
      return dateStr; // Fallback to showing the raw date string
    }
  };

  const groupedEvents = groupEventsByDate(selectedDate);

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
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onCalendarPress={handleCalendarPress}
        />

        <ScrollView
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#db2777"
              colors={["#db2777"]}
            />
          }
        >
          {groupedEvents.length > 0 ? (
            groupedEvents.map((group) => (
              <View key={group.date} style={styles.dateSection}>
                {/* Date Header */}
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>
                    {formatDateHeader(group.date)}
                  </Text>
                  <Text style={styles.eventCount}>
                    {group.events.length}{" "}
                    {group.events.length === 1 ? "evento" : "eventi"}
                  </Text>
                </View>

                {/* Horizontal Scroll of Events for this Date */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.eventsRow}
                  contentContainerStyle={styles.eventsRowContent}
                >
                  {group.events.map((event) => (
                    <View key={event.id} style={styles.eventCardWrapper}>
                      <EventCard
                        event={event}
                        onPress={() => handleEventPress(event)}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🎉</Text>
              <Text style={styles.emptyStateText}>
                Nessun evento in programma
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Controlla altre date dal calendario
              </Text>
            </View>
          )}
        </ScrollView>
      </ThemedView>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Seleziona una data</Text>
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={{
                [selectedDate.toISOString().split("T")[0]]: {
                  selected: true,
                  selectedColor: "#ec4899",
                },
              }}
              theme={{
                backgroundColor: "#1f2937",
                calendarBackground: "#1f2937",
                textSectionTitleColor: "#9ca3af",
                selectedDayBackgroundColor: "#ec4899",
                selectedDayTextColor: "#ffffff",
                todayTextColor: "#ec4899",
                dayTextColor: "#ffffff",
                textDisabledColor: "#4b5563",
                monthTextColor: "#ffffff",
                arrowColor: "#ec4899",
              }}
            />
          </View>
        </View>
      </Modal>

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
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  mainScroll: {
    flex: 1,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  eventCount: {
    fontSize: 14,
    color: "#9ca3af",
  },
  eventsRow: {
    paddingTop: 12,
  },
  eventsRowContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  eventCardWrapper: {
    width: 320,
    marginRight: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarModal: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
  },
  calendarHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
});
