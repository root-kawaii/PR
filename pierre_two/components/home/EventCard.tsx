import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/context/ThemeContext';
import { Event } from '@/types';

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
      <View style={[styles.eventImageContainer, { backgroundColor: theme.backgroundElevated }]}>
        <Image source={{ uri: event.image }} style={styles.eventImage} />
        {event.status && (
          <View style={[styles.statusBadge, { backgroundColor: theme.error }]}>
            <ThemedText style={styles.statusText}>{event.status}</ThemedText>
          </View>
        )}
        <View style={styles.eventInfo}>
          <ThemedText style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
            {event.title}
          </ThemedText>
          <ThemedText style={[styles.eventDate, { color: theme.textSecondary }]}>{formatEventTime(event)}</ThemedText>
          <ThemedText style={[styles.eventVenue, { color: theme.textTertiary }]} numberOfLines={1}>
            {event.venue}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  eventCard: {
    width: 280,
    marginRight: 16,
  },
  eventImageContainer: {
    width: 280,
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 2,
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
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 24,
  },
  eventDate: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 12,
    fontWeight: '400',
  },
});
