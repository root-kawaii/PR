import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/context/ThemeContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { Event } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';

const fuzzyMatch = (text: string, search: string): boolean => {
  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();

  if (textLower.includes(searchLower)) return true;

  let searchIndex = 0;
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++;
    }
  }
  return searchIndex === searchLower.length;
};

const isEventInFuture = (dateStr: string): boolean => {
  const monthMap: { [key: string]: number } = {
    GEN: 0, FEB: 1, MAR: 2, APR: 3, MAG: 4, GIU: 5,
    LUG: 6, AGO: 7, SET: 8, OTT: 9, NOV: 10, DIC: 11,
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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { events, loading } = useEvents();
  const { theme } = useTheme();
  const router = useRouter();
  const resultsOpacity = useRef(new Animated.Value(1)).current;
  const resultsTranslateY = useRef(new Animated.Value(0)).current;

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!isEventInFuture(event.date)) return false;
      if (!deferredSearchQuery.trim()) return true;

      return (
        fuzzyMatch(event.title, deferredSearchQuery) ||
        fuzzyMatch(event.venue, deferredSearchQuery) ||
        (event.description && fuzzyMatch(event.description, deferredSearchQuery))
      );
    });
  }, [events, deferredSearchQuery]);

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: '/',
      params: { eventId: event.id },
    });
  };

  useEffect(() => {
    resultsOpacity.setValue(0.82);
    resultsTranslateY.setValue(10);

    Animated.parallel([
      Animated.timing(resultsOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(resultsTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [deferredSearchQuery, loading, resultsOpacity, resultsTranslateY]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerBlock}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
            >
              <IconSymbol name="chevron.left" size={20} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={[styles.pageTitle, { color: theme.text }]}>Cerca eventi</Text>
              <Text style={[styles.pageSubtitle, { color: theme.textTertiary }]}>
                Artisti, locali e serate in arrivo
              </Text>
            </View>
          </View>

          <View style={[styles.searchShell, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <LinearGradient
              colors={[`${theme.primary}12`, 'rgba(0,0,0,0)'] as [string, string]}
              style={styles.searchGlow}
            />
            <View style={styles.searchRow}>
              <IconSymbol name="magnifyingglass" size={18} color={theme.textTertiary} />
              <TextInput
                style={[styles.searchBar, { color: theme.text }]}
                placeholder="Cerca eventi, artisti o locali..."
                placeholderTextColor={theme.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <IconSymbol name="xmark" size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={{
            opacity: resultsOpacity,
            transform: [{ translateY: resultsTranslateY }],
          }}
        >
          {!loading ? (
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: theme.textTertiary }]}>
                {filteredEvents.length} {filteredEvents.length === 1 ? 'evento trovato' : 'eventi trovati'}
              </Text>
              {deferredSearchQuery.trim() ? (
                <View style={[styles.queryPill, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                  <Text style={[styles.queryPillText, { color: theme.primary }]} numberOfLines={1}>
                    {deferredSearchQuery}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.centerContainer}>
              <View style={[styles.loadingOrb, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
              <Text style={[styles.loadingText, { color: theme.textTertiary }]}>Stiamo preparando gli eventi...</Text>
            </View>
          ) : filteredEvents.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.backgroundSurface }]}>
                <IconSymbol name="magnifyingglass" size={30} color={theme.primary} />
              </View>
              <Text style={[styles.emptyText, { color: theme.text }]}>
                {deferredSearchQuery.trim() ? 'Nessun evento trovato' : 'Cerca il tuo prossimo evento'}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                {deferredSearchQuery.trim()
                  ? 'Prova con un nome diverso, un artista o una citta.'
                  : 'Inizia a digitare per esplorare gli eventi futuri.'}
              </Text>
            </View>
          ) : (
            <View style={styles.resultsList}>
              {filteredEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventRow, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
                  onPress={() => handleEventPress(event)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: event.image }}
                    style={[styles.eventImg, { backgroundColor: theme.border }]}
                    resizeMode="cover"
                  />
                  <View style={styles.eventCopy}>
                    <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <View style={styles.eventMetaRow}>
                      <IconSymbol name="calendar" size={13} color={theme.primary} />
                      <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                        {event.date}
                      </Text>
                    </View>
                    <View style={styles.eventMetaRow}>
                      <IconSymbol name="location.fill" size={13} color={theme.textTertiary} />
                      <Text style={[styles.eventMeta, { color: theme.textTertiary }]} numberOfLines={1}>
                        {event.venue}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.chevronWrap, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                    <IconSymbol name="chevron.right" size={16} color={theme.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerBlock: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  searchShell: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  searchGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  queryPill: {
    maxWidth: 160,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  queryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingOrb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  loadingText: {
    fontSize: 15,
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 28,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsList: {
    gap: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  eventImg: {
    width: 92,
    height: 92,
    borderRadius: 14,
  },
  eventCopy: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  eventMeta: {
    fontSize: 13,
    flex: 1,
  },
  chevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
