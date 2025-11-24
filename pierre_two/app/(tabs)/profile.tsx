import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet, Text, TouchableOpacity, View, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';

export const options = {
  icon: 'person',
  tabBarLabel: 'Profile',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setRefreshing(false);
  };

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

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#db2777"
              colors={["#db2777"]}
              progressViewOffset={60}
            />
          }
        >
          {/* Profile Header with Avatar */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarSection}>
              <LinearGradient
                colors={['#db2777', '#ec4899']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {getInitials(user?.name || 'User')}
                </Text>
              </LinearGradient>
              <View style={styles.userInfo}>
                <ThemedText type="title" style={styles.userName}>
                  {user?.name || 'User'}
                </ThemedText>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.settingsButton}>
              <IconSymbol name="gearshape.fill" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <LinearGradient
              colors={['#1f2937', '#111827']}
              style={styles.statCard}
            >
              <IconSymbol name="ticket.fill" size={24} color="#db2777" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#1f2937', '#111827']}
              style={styles.statCard}
            >
              <IconSymbol name="clock.fill" size={24} color="#fbbf24" />
              <Text style={styles.statValue}>4</Text>
              <Text style={styles.statLabel}>Past Events</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#1f2937', '#111827']}
              style={styles.statCard}
            >
              <IconSymbol name="heart.fill" size={24} color="#ef4444" />
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(219, 39, 119, 0.2)' }]}>
                    <IconSymbol name="person.3.fill" size={20} color="#db2777" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Following</Text>
                    <Text style={styles.actionSubtitle}>1 artist • 0 venues</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                    <IconSymbol name="person.2.fill" size={20} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Friends</Text>
                    <Text style={styles.actionSubtitle}>Connect with friends</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                    <IconSymbol name="square.stack.3d.up.fill" size={20} color="#22c55e" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Groups</Text>
                    <Text style={styles.actionSubtitle}>Create or join groups</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                    <IconSymbol name="music.note" size={20} color="#a855f7" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Music Preferences</Text>
                    <Text style={styles.actionSubtitle}>Set your favorite genres</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                    <IconSymbol name="bell.fill" size={20} color="#ec4899" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Notifications</Text>
                    <Text style={styles.actionSubtitle}>Manage your alerts</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              style={styles.logoutGradient}
            >
              <IconSymbol name="arrow.right.square.fill" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 24,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: '#9ca3af',
    fontSize: 13,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3748',
    gap: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  actionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
  },
  logoutCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
