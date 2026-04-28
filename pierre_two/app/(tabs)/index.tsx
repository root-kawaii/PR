import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  Text,
  Modal,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { EventCard } from "@/components/home/EventCard";
import { EventDetailModal } from "@/components/event/EventDetailModal";
import { TableReservationModal } from "@/components/reservation/TableReservationModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useEvents } from "@/hooks/useEvents";
import { useModal } from "@/hooks/useModal";
import { useTheme } from "@/context/ThemeContext";
import { Event, Table } from "@/types";
import { getEventDateKey } from "@/utils/events";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { trackEvent } from "@/config/analytics";

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const {
    events,
    loading,
    refetch: refetchEvents,
    loadMore,
    loadingMore,
    hasMore,
  } = useEvents();
  const eventModal = useModal();
  const reservationModal = useModal();
  const params = useLocalSearchParams();

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseDateKey = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  useFocusEffect(
    useCallback(() => {
      refetchEvents(true);
    }, [refetchEvents]),
  );

  useEffect(() => {
    if (params.eventId && events.length > 0) {
      const event = events.find((e) => e.id === params.eventId);
      if (event) {
        handleEventPress(event);
      }
    }
  }, [params.eventId, events]);

  useEffect(() => {
    if (loading) {
      return;
    }

    trackEvent("home_events_loaded", {
      result_count: events.length,
      selected_date: toDateKey(selectedDate),
      has_more: hasMore,
    });
  }, [events.length, hasMore, loading, selectedDate]);

  const onRefresh = async () => {
    trackEvent("home_events_refresh_requested", {
      selected_date: toDateKey(selectedDate),
    });
    setRefreshing(true);
    await refetchEvents(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const handleEventPress = (event: Event) => {
    trackEvent("event_card_selected", {
      event_id: event.id,
      event_title: event.title,
      venue: event.venue,
    });
    setSelectedEvent(event);
    eventModal.open();
  };

  const handleReserveTable = (table?: Table) => {
    const tableToReserve = table || selectedEvent?.tables?.[0] || null;
    setSelectedTable(tableToReserve);
    eventModal.close();
    setTimeout(() => reservationModal.open(), 300);
  };

  const handleDateSelect = (day: any) => {
    trackEvent("home_date_selected", {
      selected_date: day.dateString,
    });
    setSelectedDate(parseDateKey(day.dateString));
    setShowCalendar(false);
  };

  const extractEventDate = (dateStr: string): string | null => {
    try {
      return getEventDateKey(dateStr);
    } catch (e) {
      console.error("Error extracting date:", dateStr, e);
      return null;
    }
  };

  const groupEventsByDate = (startDate: Date) => {
    const dateStr = toDateKey(startDate);

    const filteredEvents = events.filter((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return false;

      return eventDate >= dateStr;
    });

    const grouped: { [key: string]: Event[] } = {};
    filteredEvents.forEach((event) => {
      const eventDate = extractEventDate(event.date);
      if (!eventDate) return;

      if (!grouped[eventDate]) {
        grouped[eventDate] = [];
      }
      grouped[eventDate].push(event);
    });

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
      return dateStr;
    }
  };

  const groupedEvents = groupEventsByDate(selectedDate);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    if (nearBottom && hasMore && !loadingMore) loadMore();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={{
            paddingBottom: 112 + insets.bottom,
          }}
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
                  <Text style={[styles.topTitle, { color: theme.text }]}>
                    Trova il tuo evento
                  </Text>
                  <Text
                    style={[styles.topSubtitle, { color: theme.textTertiary }]}
                  >
                    Scopri gli eventi e prenota la tua prossima serata.
                  </Text>
                </View>
                <View style={styles.topActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.topActionButton,
                      {
                        backgroundColor: theme.backgroundElevated,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setShowCalendar(true)}
                    onPressIn={() => {
                      trackEvent("home_calendar_opened", {
                        selected_date: toDateKey(selectedDate),
                      });
                    }}
                  >
                    <IconSymbol name="calendar" size={21} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {groupedEvents.length > 0 ? (
              groupedEvents.map((group) => (
                <View key={group.date} style={styles.dateSection}>
                  <View
                    style={[
                      styles.dateAccent,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                  <View style={styles.dateHeader}>
                    <View style={styles.dateHeaderCopy}>
                      <Text
                        style={[styles.dateHeaderText, { color: theme.text }]}
                      >
                        {formatDateHeader(group.date)}
                      </Text>
                      <Text
                        style={[
                          styles.dateHeaderSubtext,
                          { color: theme.textTertiary },
                        ]}
                      >
                        {group.events.length}{" "}
                        {group.events.length === 1
                          ? "evento disponibile"
                          : "eventi disponibili"}
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
                        <Text
                          style={[styles.eventCount, { color: theme.primary }]}
                        >
                          {group.events.length}
                        </Text>
                      </View>
                    </View>
                  </View>

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
                <Text
                  style={[
                    styles.emptyStateSubtext,
                    { color: theme.textTertiary },
                  ]}
                >
                  Controlla altre date dal calendario
                </Text>
              </View>
            )}
          </View>

          {loadingMore && (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={{ marginVertical: 16 }}
            />
          )}
        </ScrollView>
      </View>

      <Modal
        visible={showCalendar}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable
          style={[
            styles.calendarModalOverlay,
            { backgroundColor: theme.overlay },
          ]}
          onPress={() => setShowCalendar(false)}
        >
          <Pressable
            style={[
              styles.calendarModal,
              {
                backgroundColor: theme.backgroundSurface,
                borderColor: theme.border,
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={[
                styles.calendarHeader,
                { borderBottomColor: theme.border },
              ]}
            >
              <View style={styles.calendarHeaderSpacer} />
              <Text style={[styles.calendarTitle, { color: theme.text }]}>
                Seleziona una data
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.calendarCloseButton,
                  {
                    backgroundColor: theme.backgroundElevated,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowCalendar(false)}
              >
                <IconSymbol name="xmark" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={{
                [toDateKey(selectedDate)]: {
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
          </Pressable>
        </Pressable>
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
    paddingTop: 14,
    paddingBottom: 48,
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
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 6,
  },
  topSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  topActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  eventsRow: {},
  eventsRowContent: {
    paddingLeft: 16,
    paddingRight: 28,
    paddingBottom: 8,
  },
  eventCardWrapper: {
    marginRight: 14,
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
    borderRadius: 18,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
    borderWidth: 1,
  },
  calendarHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  calendarHeaderSpacer: {
    width: 40,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  calendarCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
