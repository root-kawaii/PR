import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet, Text, TouchableOpacity, View, Alert, ScrollView, RefreshControl, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from '@/config/api';
import { ThemeSelector } from '@/components/settings/ThemeSelector';

export const options = {
  icon: 'person',
  tabBarLabel: 'Profile',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
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

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    sectionTitle: {
      color: theme.text,
      fontWeight: 'bold' as const,
      fontSize: 18,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    actionCardGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground,
    },
    actionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600' as const,
      marginBottom: 2,
    },
    actionSubtitle: {
      color: theme.textTertiary,
      fontSize: 13,
    },
    input: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    verificationSection: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 16,
      backgroundColor: theme.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={dynamicStyles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressViewOffset={60}
            />
          }
        >
          {/* Profile Header with Avatar */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarSection}>
              <LinearGradient
                colors={theme.gradientPrimary as [string, string]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {getInitials(user?.name || 'User')}
                </Text>
              </LinearGradient>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.text }]}>
                  {user?.name || 'User'}
                </Text>
                <Text style={[styles.userEmail, { color: theme.textTertiary }]}>{user?.email}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.settingsButton, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
              <IconSymbol name="gearshape.fill" size={24} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Account</Text>

            {/* Phone Verification */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => setShowPhoneVerification(!showPhoneVerification)}
            >
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.success}33` }]}>
                    <IconSymbol
                      name={isPhoneVerified ? "checkmark.circle" : "phone"}
                      size={20}
                      color={isPhoneVerified ? theme.success : theme.info}
                    />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Verifica Numero</Text>
                    <Text style={dynamicStyles.actionSubtitle}>
                      {isPhoneVerified ? 'Verificato ✓' : 'Non verificato'}
                    </Text>
                  </View>
                </View>
                <IconSymbol
                  name={showPhoneVerification ? "chevron.down" : "chevron.right"}
                  size={20}
                  color={theme.textTertiary}
                />
              </View>
            </TouchableOpacity>

            {/* Phone Verification Expanded */}
            {showPhoneVerification && (
              <View style={dynamicStyles.verificationSection}>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Numero di telefono"
                  placeholderTextColor={theme.textTertiary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  editable={!codeSent}
                />

                {!codeSent ? (
                  <TouchableOpacity
                    style={[styles.sendCodeButton, { backgroundColor: theme.primary }]}
                    onPress={handleSendVerificationCode}
                  >
                    <Text style={styles.sendCodeButtonText}>Invia Codice SMS</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={dynamicStyles.input}
                      placeholder="Codice di verifica (6 cifre)"
                      placeholderTextColor={theme.textTertiary}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={styles.verificationButtons}>
                      <TouchableOpacity
                        style={[styles.verifyButton, { backgroundColor: theme.success }]}
                        onPress={handleVerifyCode}
                      >
                        <Text style={styles.verifyButtonText}>Verifica</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.resendButton, { backgroundColor: theme.backgroundSurface }]}
                        onPress={handleSendVerificationCode}
                      >
                        <Text style={[styles.resendButtonText, { color: theme.text }]}>Invia di nuovo</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.warning}33` }]}>
                    <IconSymbol name="lock" size={20} color={theme.warning} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Cambia Password</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Aggiorna la tua password</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.primary}33` }]}>
                    <IconSymbol name="person" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Modifica Profilo</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Nome, email, data di nascita</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Notifiche</Text>

            <View style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.primary}33` }]}>
                    <IconSymbol name="bell.fill" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Notifiche Push</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Ricevi notifiche push</Text>
                  </View>
                </View>
                <Switch
                  value={pushNotifications}
                  onValueChange={setPushNotifications}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.info}33` }]}>
                    <IconSymbol name="envelope" size={20} color={theme.info} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Email</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Ricevi email promozionali</Text>
                  </View>
                </View>
                <Switch
                  value={emailNotifications}
                  onValueChange={setEmailNotifications}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.secondary}33` }]}>
                    <IconSymbol name="clock.fill" size={20} color={theme.secondary} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Promemoria Eventi</Text>
                    <Text style={dynamicStyles.actionSubtitle}>24h prima dell'evento</Text>
                  </View>
                </View>
                <Switch
                  value={eventReminders}
                  onValueChange={setEventReminders}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>App</Text>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.secondary}33` }]}>
                    <IconSymbol name="music.note" size={20} color={theme.secondary} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Preferenze Musicali</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Imposta i tuoi generi preferiti</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>

            {/* Theme Selector */}
            <ThemeSelector />

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.success}33` }]}>
                    <IconSymbol name="globe" size={20} color={theme.success} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Lingua</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Italiano</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Supporto</Text>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.info}33` }]}>
                    <IconSymbol name="questionmark.circle" size={20} color={theme.info} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Centro Assistenza</Text>
                    <Text style={dynamicStyles.actionSubtitle}>FAQ e supporto</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.warning}33` }]}>
                    <IconSymbol name="doc.text" size={20} color={theme.warning} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Termini e Privacy</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Leggi i termini di servizio</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionCardGradient, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconCircle, { backgroundColor: `${theme.primary}33` }]}>
                    <IconSymbol name="info.circle" size={20} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={dynamicStyles.actionTitle}>Informazioni</Text>
                    <Text style={dynamicStyles.actionSubtitle}>Versione 1.0.0</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
            <LinearGradient
              colors={[theme.error, theme.error]}
              style={styles.logoutGradient}
            >
              <IconSymbol name="arrow.right.square.fill" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  section: {
    marginBottom: 24,
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
    borderRadius: 16,
    borderWidth: 1,
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
  sendCodeButton: {
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
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
