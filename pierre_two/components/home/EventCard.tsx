import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Event } from '@/types';

type EventCardProps = {
  event: Event;
  onPress: () => void;
};

export const EventCard = ({ event, onPress }: EventCardProps) => (
  <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.9}>
    <View style={styles.eventImageContainer}>
      <Image source={{ uri: event.image }} style={styles.eventImage} />
      {event.status && (
        <View style={styles.statusBadge}>
          <ThemedText style={styles.statusText}>{event.status}</ThemedText>
        </View>
      )}
      <View style={styles.eventInfo}>
        <ThemedText style={styles.eventTitle} numberOfLines={2}>
          {event.title}
        </ThemedText>
        <ThemedText style={styles.eventDate}>{event.date}</ThemedText>
        <ThemedText style={styles.eventVenue} numberOfLines={1}>
          {event.venue}
        </ThemedText>
      </View>
    </View>
  </TouchableOpacity>
);

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
    backgroundColor: '#1a1a1a',
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
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
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
    color: '#fff',
    marginBottom: 6,
    lineHeight: 24,
  },
  eventDate: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
});