import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { Event } from '@/types';

// Fuzzy match helper function
const fuzzyMatch = (text: string, search: string): boolean => {
  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();

  // Direct substring match
  if (textLower.includes(searchLower)) return true;

  // Fuzzy character-by-character match
  let searchIndex = 0;
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++;
    }
  }
  return searchIndex === searchLower.length;
};

// Parse Italian date format and check if event is in the future
const isEventInFuture = (dateStr: string): boolean => {
  const monthMap: { [key: string]: number } = {
    'GEN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAG': 4, 'GIU': 5,
    'LUG': 6, 'AGO': 7, 'SET': 8, 'OTT': 9, 'NOV': 10, 'DIC': 11
  };

  const parts = dateStr.split('|')[0].trim().split(' ');
  if (parts.length !== 2) return true;

  const day = parseInt(parts[0]);
  const monthStr = parts[1];
  const month = monthMap[monthStr];

  if (month === undefined) return true;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const eventYear = month < currentMonth ? currentYear + 1 : currentYear;
  const eventDate = new Date(eventYear, month, day);

  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  return eventDate >= today;
};

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const { events, loading } = useEvents();
  const router = useRouter();

  // Filter events: future only + fuzzy search match
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Only future events
      if (!isEventInFuture(event.date)) return false;

      // If no search query, show all future events
      if (!searchQuery.trim()) return true;

      // Fuzzy match against title, venue, or description
      return fuzzyMatch(event.title, searchQuery) ||
             fuzzyMatch(event.venue, searchQuery) ||
             (event.description && fuzzyMatch(event.description, searchQuery));
    });
  }, [events, searchQuery]);

  const handleEventPress = (event: Event) => {
    // Store the event for opening in home screen
    // For now, just navigate back - in a full implementation,
    // you'd pass the event through navigation params
    router.push({
      pathname: '/',
      params: { eventId: event.id }
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color="#fff" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchBar}
            placeholder="Cerca eventi, artisti o locali..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>

        <ScrollView>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#db2777" />
              <Text style={styles.loadingText}>Caricamento eventi...</Text>
            </View>
          ) : filteredEvents.length === 0 ? (
            <View style={styles.centerContainer}>
              <IconSymbol name="magnifyingglass" size={64} color="#444" />
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? 'Nessun evento trovato' : 'Cerca eventi futuri'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery.trim()
                  ? 'Prova con parole diverse'
                  : 'Inizia a digitare per cercare'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultsCount}>
                {filteredEvents.length} {filteredEvents.length === 1 ? 'evento trovato' : 'eventi trovati'}
              </Text>
              {filteredEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventRow}
                  onPress={() => handleEventPress(event)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: event.image }}
                    style={styles.eventImg}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.eventMetaRow}>
                      <IconSymbol name="calendar" size={14} color="#9ca3af" />
                      <Text style={styles.eventMeta}>{event.date}</Text>
                    </View>
                    <View style={styles.eventMetaRow}>
                      <IconSymbol name="location.fill" size={14} color="#9ca3af" />
                      <Text style={styles.eventMeta} numberOfLines={1}>{event.venue}</Text>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color="#666" />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    padding: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  resultsCount: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  eventImg: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  eventTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  eventMeta: {
    color: '#9ca3af',
    fontSize: 13,
  },
});
