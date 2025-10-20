import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const tickets = [
  {
    title: 'Quercia + Emo Night',
    venue: 'Legend Club',
    date: '3 months ago',
    image: require('@/assets/images/partial-react-logo.png'),
    tag: 'Live + dj set',
    count: 1,
  },
  {
    title: 'SIAMO 360 w/ Faccianuvola and many more',
    venue: 'Circolo Magnolia (Estivo)',
    date: '3 months ago',
    image: require('@/assets/images/react-logo.png'),
    tag: 'Festival',
    count: 1,
  },
];

export const options = {
  icon: 'confirmation-number',
  tabBarLabel: 'Tickets',
};

export default function TicketsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.header}>Events you went to</ThemedText>
        {tickets.map((ticket, i) => (
          <View key={i} style={styles.ticketCard}>
            <Image source={ticket.image} style={styles.ticketImage} resizeMode="cover" />
            <View style={styles.ticketOverlay}>
              <Text style={styles.ticketTitle}>{ticket.title}</Text>
              <Text style={styles.ticketVenue}>{ticket.venue}</Text>
              <Text style={styles.ticketDate}>{ticket.date}</Text>
              <View style={styles.ticketTag}><Text style={styles.ticketTagText}>{ticket.tag}</Text></View>
              <View style={styles.ticketCount}><Text style={styles.ticketCountText}>{ticket.count}</Text></View>
            </View>
          </View>
        ))}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 16 },
  header: { color: '#fff', marginBottom: 18, fontSize: 24 },
  ticketCard: {
    marginBottom: 24,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#222',
    position: 'relative',
    height: 220,
  },
  ticketImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.85,
  },
  ticketOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
    height: '100%',
  },
  ticketTitle: { color: '#fff', fontWeight: 'bold', fontSize: 20, marginBottom: 4 },
  ticketVenue: { color: '#fff', fontSize: 15, marginBottom: 2 },
  ticketDate: { color: '#ccc', fontSize: 13, marginBottom: 8 },
  ticketTag: { backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  ticketTagText: { color: '#fff', fontSize: 12 },
  ticketCount: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#222', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  ticketCountText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
