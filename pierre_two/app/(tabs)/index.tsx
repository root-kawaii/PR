import { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { SearchBar } from '@/components/home/SearchBar';
import { SectionHeader } from '@/components/home/SectionHeader';
import { EventCard } from '@/components/home/EventCard';
import { ClubCard } from '@/components/home/ClubCard';
import { GenreCard } from '@/components/home/GenreCard';
import { EventDetailModal } from '@/components/event/EventDetailModal';
import { TableReservationModal } from '@/components/reservation/TableReservationModal';
import { useEvents } from '@/hooks/useEvents';
import { useGenres } from '@/hooks/useGenres';
import { useClubs } from '@/hooks/useClubs';
import { useModal } from '@/hooks/useModal';
import { Event, Table } from '@/types';
import { useLocalSearchParams } from 'expo-router';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { events, loading: eventsLoading, refetch: refetchEvents } = useEvents();
  const { genres, loading: genresLoading, refetch: refetchGenres } = useGenres();
  const { clubs, loading: clubsLoading, refetch: refetchClubs } = useClubs();
  const eventModal = useModal();
  const reservationModal = useModal();
  const params = useLocalSearchParams();

  // Handle navigation from search page
  useEffect(() => {
    if (params.eventId && events.length > 0) {
      const event = events.find(e => e.id === params.eventId);
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
      refetchClubs(true)
    ]);
    await new Promise(resolve => setTimeout(resolve, 600));
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
            <SectionHeader icon="calendar" title="Questa settimana" iconColor="#ef4444" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} onPress={() => handleEventPress(event)} />
              ))}
            </ScrollView>
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
            <SectionHeader icon="music.note" title="Generi musicali" iconColor="#10b981" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1 },
  section: { paddingHorizontal: 16, paddingVertical: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  genreGrid: { flexDirection: 'row', gap: 12 },
});