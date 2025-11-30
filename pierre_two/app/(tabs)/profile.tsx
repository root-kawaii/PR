import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet, Text, TouchableOpacity, View, Alert, ScrollView, RefreshControl, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from '@/config/api';

export const options = {
  icon: 'person',
  tabBarLabel: 'Profile',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Settings state
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);

  // Phone verification
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

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

  const handleSendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Errore', 'Inserisci un numero di telefono valido');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/send-sms-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          phone_number: phoneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }

      setCodeSent(true);
      Alert.alert('Codice Inviato', 'Controlla i tuoi SMS per il codice di verifica');
    } catch (error) {
      console.error('Error sending verification code:', error);
      Alert.alert('Errore', 'Impossibile inviare il codice di verifica');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Errore', 'Inserisci un codice di verifica valido');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/verify-sms-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          phone_number: phoneNumber,
          verification_code: verificationCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid verification code');
      }

      setIsPhoneVerified(true);
      setShowPhoneVerification(false);
      setCodeSent(false);
      setVerificationCode('');
      Alert.alert('Verificato!', 'Il tuo numero di telefono è stato verificato con successo');
    } catch (error) {
      console.error('Error verifying code:', error);
      Alert.alert('Errore', 'Codice di verifica non valido');
    }
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

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            {/* Phone Verification */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => setShowPhoneVerification(!showPhoneVerification)}
            >
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                    <IconSymbol
                      name={isPhoneVerified ? "checkmark.circle" : "phone"}
                      size={20}
                      color={isPhoneVerified ? "#22c55e" : "#3b82f6"}
                    />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Verifica Numero</Text>
                    <Text style={styles.actionSubtitle}>
                      {isPhoneVerified ? 'Verificato ✓' : 'Non verificato'}
                    </Text>
                  </View>
                </View>
                <IconSymbol
                  name={showPhoneVerification ? "chevron.down" : "chevron.right"}
                  size={20}
                  color="#6b7280"
                />
              </LinearGradient>
            </TouchableOpacity>

            {/* Phone Verification Expanded */}
            {showPhoneVerification && (
              <View style={styles.verificationSection}>
                <TextInput
                  style={styles.input}
                  placeholder="Numero di telefono"
                  placeholderTextColor="#9ca3af"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  editable={!codeSent}
                />

                {!codeSent ? (
                  <TouchableOpacity
                    style={styles.sendCodeButton}
                    onPress={handleSendVerificationCode}
                  >
                    <Text style={styles.sendCodeButtonText}>Invia Codice SMS</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Codice di verifica (6 cifre)"
                      placeholderTextColor="#9ca3af"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={styles.verificationButtons}>
                      <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={handleVerifyCode}
                      >
                        <Text style={styles.verifyButtonText}>Verifica</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.resendButton}
                        onPress={handleSendVerificationCode}
                      >
                        <Text style={styles.resendButtonText}>Invia di nuovo</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
                    <IconSymbol name="lock" size={20} color="#fbbf24" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Cambia Password</Text>
                    <Text style={styles.actionSubtitle}>Aggiorna la tua password</Text>
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
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(219, 39, 119, 0.2)' }]}>
                    <IconSymbol name="person" size={20} color="#db2777" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Modifica Profilo</Text>
                    <Text style={styles.actionSubtitle}>Nome, email, data di nascita</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifiche</Text>

            <View style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                    <IconSymbol name="bell.fill" size={20} color="#ec4899" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Notifiche Push</Text>
                    <Text style={styles.actionSubtitle}>Ricevi notifiche push</Text>
                  </View>
                </View>
                <Switch
                  value={pushNotifications}
                  onValueChange={setPushNotifications}
                  trackColor={{ false: '#374151', true: '#ec4899' }}
                  thumbColor="#fff"
                />
              </LinearGradient>
            </View>

            <View style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                    <IconSymbol name="envelope" size={20} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Email</Text>
                    <Text style={styles.actionSubtitle}>Ricevi email promozionali</Text>
                  </View>
                </View>
                <Switch
                  value={emailNotifications}
                  onValueChange={setEmailNotifications}
                  trackColor={{ false: '#374151', true: '#ec4899' }}
                  thumbColor="#fff"
                />
              </LinearGradient>
            </View>

            <View style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                    <IconSymbol name="clock.fill" size={20} color="#a855f7" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Promemoria Eventi</Text>
                    <Text style={styles.actionSubtitle}>24h prima dell'evento</Text>
                  </View>
                </View>
                <Switch
                  value={eventReminders}
                  onValueChange={setEventReminders}
                  trackColor={{ false: '#374151', true: '#ec4899' }}
                  thumbColor="#fff"
                />
              </LinearGradient>
            </View>
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App</Text>

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
                    <Text style={styles.actionTitle}>Preferenze Musicali</Text>
                    <Text style={styles.actionSubtitle}>Imposta i tuoi generi preferiti</Text>
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
                    <IconSymbol name="globe" size={20} color="#22c55e" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Lingua</Text>
                    <Text style={styles.actionSubtitle}>Italiano</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supporto</Text>

            <TouchableOpacity style={styles.actionCard}>
              <LinearGradient
                colors={['#1f2937', '#111827']}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                    <IconSymbol name="questionmark.circle" size={20} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Centro Assistenza</Text>
                    <Text style={styles.actionSubtitle}>FAQ e supporto</Text>
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
                  <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
                    <IconSymbol name="doc.text" size={20} color="#fbbf24" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Termini e Privacy</Text>
                    <Text style={styles.actionSubtitle}>Leggi i termini di servizio</Text>
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
                    <IconSymbol name="info.circle" size={20} color="#ec4899" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Informazioni</Text>
                    <Text style={styles.actionSubtitle}>Versione 1.0.0</Text>
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
  verificationSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2d3748',
    marginBottom: 12,
  },
  sendCodeButton: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  sendCodeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
