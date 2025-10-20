import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const options = {
  icon: 'home',
  tabBarLabel: 'Home',
};

type Event = {
  id: string;
  title: string;
  image: string;
};

export default function HomeScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        // Replace with your real API endpoint
        const res = await fetch('http://127.0.0.1:3000/events');
        const data = await res.json();
        setEvents(data.events || []);
      } catch (e) {
        setEvents([]); // fallback to empty
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.header}>Main Events</ThemedText>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.eventsContainer} showsVerticalScrollIndicator={false}>
            {events.map(event => (
              <View key={event.id} style={styles.eventCard}>
                <Image source={{ uri: event.image }} style={styles.eventImage} resizeMode="cover" />
                <BlurView intensity={50} tint="light" style={styles.blurOverlay}>
                  <ThemedText type="subtitle" style={styles.eventTitle}>{event.title}</ThemedText>
                  <TouchableOpacity style={styles.wishlistButton}>
                    <IconSymbol name="chevron.right" size={24} color="#e74c3c" />
                  </TouchableOpacity>
                </BlurView>
              </View>
            ))}
          </ScrollView>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  eventsContainer: {
    gap: 24,
    alignItems: 'center',
    paddingBottom: 32,
  },
  eventCard: {
    width: 280,
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  blurOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  eventTitle: {
    fontSize: 22,
    color: '#222',
    flex: 1,
  },
  wishlistButton: {
    backgroundColor: '#f9eaea',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
});
