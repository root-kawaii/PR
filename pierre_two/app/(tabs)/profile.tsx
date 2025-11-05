import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const following = [
  { label: '1 artist', icon: '👤' },
  { label: '0 venues', icon: '🏟️' },
  { label: '0 promoters', icon: '🎤' },
];

export const options = {
  icon: 'person',
  tabBarLabel: 'Profile',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <View style={styles.profileHeader}>
          <View>
            <ThemedText type="title" style={styles.header}>{user?.name || 'User'}</ThemedText>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Following</Text>
        <View style={styles.followRow}>
          {following.map((item, i) => (
            <View key={i} style={styles.followCircle}>
              <Text style={styles.followIcon}>{item.icon}</Text>
              <Text style={styles.followLabel}>{item.label}</Text>
              <TouchableOpacity style={styles.addBtn}><Text style={styles.addBtnText}>+</Text></TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.friendsBox}>
          <Text style={styles.friendsText}>0/3</Text>
          <Text style={styles.friendsDesc}>Follow 3 friends{"\n"}See what they're interested in and we'll suggest shows you can go to together.</Text>
        </View>
        <Text style={styles.sectionTitle}>Groups</Text>
        <View style={styles.groupBox}>
          <Text style={styles.groupPlus}>+</Text>
        </View>
        <Text style={styles.groupDesc}>Get friends together, vote on events and see who's going.</Text>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 16 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  header: { color: '#fff', marginBottom: 4, fontSize: 28 },
  email: { color: '#888', fontSize: 14, marginBottom: 8 },
  logoutButton: { backgroundColor: '#FF6B6B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sectionTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  followRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  followCircle: { backgroundColor: '#222', borderRadius: 40, width: 80, height: 80, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  followIcon: { fontSize: 28, color: '#fff' },
  followLabel: { color: '#fff', fontSize: 13, marginTop: 4 },
  addBtn: { position: 'absolute', right: 6, bottom: 6, backgroundColor: '#fff', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#111', fontSize: 18, fontWeight: 'bold' },
  friendsBox: { backgroundColor: '#222', borderRadius: 16, padding: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  friendsText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  friendsDesc: { color: '#aaa', fontSize: 13, flex: 1 },
  groupBox: { backgroundColor: '#222', borderRadius: 16, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  groupPlus: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  groupDesc: { color: '#aaa', fontSize: 13 },
});
