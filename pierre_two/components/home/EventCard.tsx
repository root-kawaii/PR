import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/context/ThemeContext';
import { Event } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';

type EventCardProps = {
  event: Event;
  onPress: () => void;
};

const formatEventTime = (event: Event) => {
  // Prefer the time field if available
  if (event.time) {
    return event.time;
  }

  // Fallback to parsing the date field
  try {
    const date = new Date(event.date);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
};

export const EventCard = ({ event, onPress }: EventCardProps) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.eventImageContainer, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
        <Image source={{ uri: event.image }} style={styles.eventImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.22)', 'rgba(8,8,8,0.97)']}
          style={styles.imageOverlay}
        />
        <LinearGradient
          colors={['rgba(201,168,76,0.15)', 'rgba(0,0,0,0)']}
          style={styles.topGlow}
        />
        <View style={[styles.topBar, { borderColor: theme.border }]}>
          <View style={[styles.iconChip, { backgroundColor: `${theme.background}d9`, borderColor: theme.border }]}>
            <IconSymbol name="ticket.fill" size={14} color={theme.primary} />
          </View>
          <View style={styles.timeBadge}>
            <IconSymbol name="clock.fill" size={14} color={theme.primary} />
            <ThemedText style={[styles.timeBadgeText, { color: theme.text }]}>{formatEventTime(event)}</ThemedText>
          </View>
        </View>
        {event.status && (
          <View style={[styles.statusBadge, { backgroundColor: theme.error }]}>
            <ThemedText style={styles.statusText}>{event.status}</ThemedText>
          </View>
        )}

        <View style={[styles.infoPanel, { backgroundColor: 'rgba(10,10,10,0.74)', borderColor: theme.border }]}>
          <View style={styles.kickerRow}>
            <ThemedText style={[styles.kickerText, { color: theme.primary }]}>
              Evento in evidenza
            </ThemedText>
            <ThemedText style={[styles.kickerDivider, { color: theme.textTertiary }]}>
              •
            </ThemedText>
            <ThemedText style={[styles.kickerText, { color: theme.textTertiary }]}>
              {event.status || 'Disponibile'}
            </ThemedText>
          </View>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
              {event.title}
            </ThemedText>
          </View>

          {event.venue ? (
            <View style={styles.metaRow}>
              <IconSymbol name="mappin" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                {event.venue}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <IconSymbol name="calendar" size={13} color={theme.textTertiary} />
            <ThemedText style={[styles.metaText, { color: theme.textTertiary }]} numberOfLines={1}>
              {event.date}
            </ThemedText>
          </View>

          {event.genres && event.genres.length > 0 && (
            <View style={styles.genreRow}>
              {event.genres.map(g => (
                <View key={g.id} style={[styles.genreBadge, { backgroundColor: g.color }]}>
                  <ThemedText style={styles.genreBadgeText}>{g.name}</ThemedText>
                </View>
              ))}
            </View>
          )}

          <View style={styles.footerRow}>
            <View style={[styles.ctaPill, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.ctaText, { color: theme.textInverse }]}>
                Apri evento
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  eventCard: {
    width: 336,
    marginRight: 18,
  },
  eventImageContainer: {
    width: 336,
    height: 450,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventInfo: {
    position: 'absolute',
  },
  infoPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kickerText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  kickerDivider: {
    fontSize: 10,
  },
  titleRow: {
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  genreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  genreBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  ctaPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
