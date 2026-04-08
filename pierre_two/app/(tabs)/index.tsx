import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
  Text,
  Modal,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { EventCard } from "@/components/home/EventCard";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { TableReservationModal } from "@/components/reservation/TableReservationModal";
import { FloatingActionButton } from "@/components/common/FloatingActionButton";
import { ReservationCodeModal } from "@/components/reservation/ReservationCodeModal";
import { TableReservationDetailModal } from "@/components/reservation/TableReservationDetailModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useEvents } from "@/hooks/useEvents";
import { useModal } from "@/hooks/useModal";
import { useTheme } from "@/context/ThemeContext";
import { Event, Table, TableReservation } from "@/types";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { API_URL } from "@/config/api";

type QuickFilterKey = "tonight" | "week" | "dates" | "venues" | "new";

export default function HomeScreen() {
  const { theme } = useTheme();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<TableReservation | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuickFilterKey | null>(null);
  const { events, refetch: refetchEvents, loadMore, loadingMore, hasMore } = useEvents();
  const eventModal = useModal();
  const reservationModal = useModal();
  const codeInputModal = useModal();
  const reservationDetailModal = useModal();
  const params = useLocalSearchParams();
  const router = useRouter();
  const quickFilters: ReadonlyArray<{
    key: QuickFilterKey;
    label: string;
    icon: "clock.fill" | "calendar" | "mappin" | "ticket.fill";
  }> = [
    { key: "tonight", label: "Tonight", icon: "clock.fill" as const },
    { key: "week", label: "This week", icon: "clock.fill" as const },
    { key: "dates", label: "Pick dates", icon: "calendar" as const },
    { key: "venues", label: "Venues", icon: "mappin" as const },
    { key: "new", label: "New shows", icon: "ticket.fill" as const },
  ];

  // Silently refetch events whenever this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchEvents(true);
    }, []),
  );

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
    setTimeout(() => reservationModal.open(), 300);
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
      if (dateStr.includes("T")) {
        return dateStr.split("T")[0];
      }

      // Handle date with space separator: '2024-12-27 23:00:00'
      if (dateStr.includes(" ") && !dateStr.includes("|")) {
        const datePart = dateStr.split(" ")[0];
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
        console.warn(
          "Skipping event with legacy Italian date format:",
          dateStr
        );
        return null;
      }

      console.warn("Unexpected date format:", dateStr);
      return null;
    } catch (e) {
      console.error("Error extracting date:", dateStr, e);
      return null;
    }
  };

  // Group events by date
  const groupEventsByDate = (startDate: Date) => {
    const dateStr = startDate.toISOString().split("T")[0];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayDate);
    weekEnd.setDate(todayDate.getDate() + 6);

    // Filter events from selected date onwards
    const filteredEvents = events.filter((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return false;

      const parsedDate = new Date(`${eventDate}T00:00:00`);

      if (activeFilter === "tonight") {
        return eventDate === todayDate.toISOString().split("T")[0];
      }

      if (activeFilter === "week") {
        return parsedDate >= todayDate && parsedDate <= weekEnd;
      }

      if (activeFilter === "new") {
        return parsedDate >= todayDate;
      }

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
      const parts = dateStr.split("-");
      if (parts.length !== 3) {
        throw new Error("Invalid date format");
      }

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error("Invalid date components");
      }

      const date = new Date(year, month - 1, day);

      const dayName = days[date.getDay()];
      const monthName = months[date.getMonth()];

      return `${dayName}, ${day} ${monthName}`;
    } catch (e) {
      console.error("Error formatting date header:", dateStr, e);
      return dateStr; // Fallback to showing the raw date string
    }
  };

  const groupedEvents = groupEventsByDate(selectedDate);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    if (nearBottom && hasMore && !loadingMore) loadMore();
  };

  const handleFABPress = () => {
    codeInputModal.open();
  };

  const handleQuickFilterPress = (filterKey: QuickFilterKey) => {
    if (filterKey === "dates") {
      setActiveFilter("dates");
      handleCalendarPress();
      return;
    }

    if (filterKey === "venues") {
      router.push("/explore");
      return;
    }

    setActiveFilter((prev) => (prev === filterKey ? null : filterKey));
  };

  const handleReservationCodeSubmit = async (code: string) => {
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={400}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          <View style={styles.contentWrap}>
          <View style={styles.topIntro}>
            <View style={styles.topIntroRow}>
              <View style={styles.topIntroCopy}>
                <Text style={[styles.topTitle, { color: theme.text }]}>Trova il tuo evento</Text>
                <Text style={[styles.topSubtitle, { color: theme.textTertiary }]}>
                  Scopri gli eventi e prenota la tua prossima serata.
                </Text>
              </View>
              <View style={styles.topActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.topActionButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
                  onPress={handleCalendarPress}
                >
                  <IconSymbol name="calendar" size={18} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFilterRow}
            style={styles.quickFilterScroll}
          >
            {quickFilters.map((filter) => (
              <View key={filter.key} style={styles.quickFilterItem}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.quickFilterButton,
                    {
                      backgroundColor:
                        activeFilter === filter.key ? `${theme.primary}26` : theme.backgroundElevated,
                      borderColor: activeFilter === filter.key ? `${theme.primary}66` : theme.border,
                    },
                  ]}
                  onPress={() => handleQuickFilterPress(filter.key)}
                >
                  <IconSymbol
                    name={filter.icon}
                    size={30}
                    color={activeFilter === filter.key ? theme.primary : theme.primaryLight}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.quickFilterLabel,
                    { color: activeFilter === filter.key ? theme.text : theme.textSecondary },
                  ]}
                >
                  {filter.label}
                </Text>
              </View>
            ))}
          </ScrollView>

          {groupedEvents.length > 0 ? (
            groupedEvents.map((group) => (
              <View
                key={group.date}
                style={styles.dateSection}
              >
                {/* Date Header */}
                <View style={[styles.dateAccent, { backgroundColor: theme.primary }]} />
                <View style={styles.dateHeader}>
                  <View style={styles.dateHeaderCopy}>
                    <Text style={[styles.dateHeaderText, { color: theme.text }]}>
                      {formatDateHeader(group.date)}
                    </Text>
                    <Text style={[styles.dateHeaderSubtext, { color: theme.textTertiary }]}>
                      {group.events.length} {group.events.length === 1 ? "evento disponibile" : "eventi disponibili"}
                    </Text>
                  </View>
                  <View style={styles.dateHeaderRight}>
                    <View
                      style={[
                        styles.dateCountBadge,
                        {
                          backgroundColor: theme.backgroundElevated,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.eventCount, { color: theme.primary }]}>
                        {group.events.length}
                      </Text>
                    </View>
                  </View>
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
              <Text style={[styles.emptyStateText, { color: theme.text }]}>
                Nessun evento in programma
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.textTertiary }]}>
                Controlla altre date dal calendario
              </Text>
            </View>
          )}
          </View>

          {loadingMore && (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 16 }} />
          )}
        </ScrollView>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={[styles.calendarModalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.calendarModal, { backgroundColor: theme.backgroundSurface }]}>
            <View style={[styles.calendarHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.calendarTitle, { color: theme.text }]}>Seleziona una data</Text>
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={{
                [selectedDate.toISOString().split("T")[0]]: {
                  selected: true,
                  selectedColor: theme.primary,
                },
              }}
              theme={{
                backgroundColor: theme.backgroundSurface,
                calendarBackground: theme.backgroundSurface,
                textSectionTitleColor: theme.textTertiary,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: theme.textInverse,
                todayTextColor: theme.primary,
                dayTextColor: theme.text,
                textDisabledColor: theme.border,
                monthTextColor: theme.text,
                arrowColor: theme.primary,
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
  },
  mainScroll: {
    flex: 1,
  },
  contentWrap: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  topIntro: {
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  topIntroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  topIntroCopy: {
    flex: 1,
  },
  topTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  topSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  topActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickFilterScroll: {
    marginBottom: 18,
  },
  quickFilterRow: {
    paddingHorizontal: 16,
    gap: 4,
  },
  quickFilterItem: {
    width: 72,
    alignItems: "center",
  },
  quickFilterButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickFilterLabel: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },
  dateSection: {
    marginHorizontal: 16,
    marginBottom: 18,
    paddingTop: 8,
    paddingBottom: 2,
  },
  dateAccent: {
    height: 3,
    width: 56,
    borderRadius: 999,
    marginLeft: 16,
    marginBottom: 12,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  dateHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  dateHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateHeaderText: {
    fontSize: 17,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dateHeaderSubtext: {
    fontSize: 12,
    marginTop: 3,
  },
  dateCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCount: {
    fontSize: 13,
    fontWeight: "800",
  },
  eventsRow: {
  },
  eventsRowContent: {
    paddingLeft: 16,
    paddingRight: 28,
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
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  calendarModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarModal: {
    borderRadius: 16,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
  },
  calendarHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
