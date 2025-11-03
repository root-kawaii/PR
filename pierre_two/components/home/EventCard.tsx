import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Event } from '@/types';

type EventCardProps = {
  event: Event;
  onPress: () => void;
};

export const EventCard = ({ event, onPress }: EventCardProps) => (
  <TouchableOpacity style={styles.eventCard} onPress={onPress}>
    <View style={styles.eventImageContainer}>
      <Image source={{ uri: event.image }} style={styles.eventImage} />
      {event.status && (
        <View style={styles.soldOutOverlay}>
          <ThemedText style={styles.soldOutText}>{event.status}</ThemedText>
        </View>
      )}
      <View style={styles.eventInfo}>
        <ThemedText style={styles.eventTitle} numberOfLines={1}>
          {event.title}
        </ThemedText>
        <ThemedText style={styles.eventDate}>{event.date}</ThemedText>
      </View>
    </View>
    <ThemedText style={styles.eventVenue} numberOfLines={1}>
      {event.venue}
    </ThemedText>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  eventCard: { width: 128 },
  eventImageContainer: {
    width: 128,
    height: 170,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    position: 'relative',
  },
  eventImage: { width: '100%', height: '100%' },
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  eventInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  eventTitle: { fontSize: 12, fontWeight: '600' },
  eventDate: { fontSize: 10, color: '#d1d5db' },
  eventVenue: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});