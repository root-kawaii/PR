import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const filters = ["DATE", "PRICE", "MONZA"];
const categories = ["Shows", "Theater", "DJ", "Film", "Party"];
const recentlyViewed = [
  { name: "Quercia", type: "Artist", image: require('@/assets/images/partial-react-logo.png') },
  { name: "Yosuke Yukimatsu", type: "Artist", image: null },
];
const popular = [
  { title: "2000 Power ai Magazza a Milano", date: "Thu 23 Oct", venue: "Magazzini Generali", image: require('@/assets/images/react-logo.png') },
  { title: "Nerone Live + Guests • Milano", date: "Wed 22 Oct", venue: "Magazzini Generali", image: require('@/assets/images/icon.png') },
  { title: "Wunder Mrkt - il Mercato allo ...", date: "Sun 2 Nov", venue: "Spirit de Milan", image: require('@/assets/images/partial-react-logo.png') },
];

export default function SearchScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search for an event, artist or venue"
          placeholderTextColor="#888"
        />
        <View style={styles.filterRow}>
          {filters.map(f => (
            <TouchableOpacity key={f} style={styles.filterButton}>
              <Text style={styles.filterText}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView>
          <View style={styles.categoryRow}>
            {categories.map(c => (
              <View key={c} style={styles.categoryBox}>
                <Text style={styles.categoryText}>{c}</Text>
              </View>
            ))}
          </View>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Recently Viewed</ThemedText>
          {recentlyViewed.map((item, i) => (
            <View key={i} style={styles.recentRow}>
              <View style={styles.avatar}>
                {item.image ? <View style={styles.avatarImg} /> : <Text style={styles.avatarIcon}>👤</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName}>{item.name}</Text>
                <Text style={styles.recentType}>{item.type}</Text>
              </View>
              <TouchableOpacity style={styles.followBtn}><Text style={styles.followText}>FOLLOW</Text></TouchableOpacity>
            </View>
          ))}
          <ThemedText type="subtitle" style={styles.sectionTitle}>Popular on DICE</ThemedText>
          {popular.map((item, i) => (
            <View key={i} style={styles.popularRow}>
              <View style={styles.popularImg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.popularTitle}>{item.title}</Text>
                <Text style={styles.popularMeta}>{item.date}</Text>
                <Text style={styles.popularMeta}>{item.venue}</Text>
              </View>
              <TouchableOpacity><Text style={styles.bookmark}>🔖</Text></TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 16 },
  searchBar: {
    backgroundColor: '#222',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterButton: { backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  filterText: { color: '#fff', fontWeight: 'bold' },
  categoryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  categoryBox: { backgroundColor: '#222', borderRadius: 12, padding: 18, minWidth: 80, alignItems: 'center' },
  categoryText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { color: '#fff', marginTop: 24, marginBottom: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#666' },
  avatarIcon: { color: '#fff', fontSize: 24 },
  recentName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  recentType: { color: '#aaa', fontSize: 13 },
  followBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6 },
  followText: { color: '#111', fontWeight: 'bold' },
  popularRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  popularImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#fff', marginRight: 12 },
  popularTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  popularMeta: { color: '#aaa', fontSize: 13 },
  bookmark: { fontSize: 22, color: '#fff', marginLeft: 8 },
});
