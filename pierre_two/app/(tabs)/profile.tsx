import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { API_URL } from '@/config/api';
import { useApiFetch } from '@/config/apiFetch';
import { PRIVACY_POLICY_URL, SUPPORT_URL, TERMS_URL } from '@/config/appLinks';
import { registerPushToken } from '@/config/pushNotifications';

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go */ }

export default function ProfileScreen() {
  const { user, token, logout, deleteAccount, updateUser } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authenticatedFetch = useApiFetch();

  const [refreshing, setRefreshing] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [eventReminders, setEventReminders] = useState(true);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(user?.phone_verified ?? false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setPhoneNumber(user?.phone_number || '');
    setIsPhoneVerified(user?.phone_verified ?? false);
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleLogout = () => {
    Alert.alert('Esci', 'Vuoi uscire dal tuo account?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleEnableNotifications = async () => {
    if (!Notifications) {
      Alert.alert('Non disponibile', 'Le notifiche non sono supportate in questa modalità.');
      return;
    }
    if (!token) {
      Alert.alert('Sessione scaduta', 'Effettua di nuovo l’accesso per attivare le notifiche.');
      return;
    }

    setNotifLoading(true);
    try {
      const result = await registerPushToken(API_URL, token);

      if (result.status === 'denied') {
        Alert.alert(
          'Notifiche disabilitate',
          'Abilita le notifiche dalle impostazioni del dispositivo.',
          [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Apri impostazioni', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      if (result.status === 'simulator' || result.status === 'unsupported') {
        Alert.alert(
          'Non disponibile',
          'Le notifiche funzionano solo su un build nativo installato su dispositivo.',
        );
        return;
      }

      Alert.alert('Notifiche attivate', 'Riceverai aggiornamenti su prenotazioni e pagamenti.');
    } catch {
      Alert.alert('Errore', 'Impossibile attivare le notifiche. Riprova.');
    } finally {
      setNotifLoading(false);
    }
  };

  const openExternalLink = async (url: string, label: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link non disponibile', `Impossibile aprire ${label} in questo momento.`);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Password richiesta', 'Inserisci la password per confermare.');
      return;
    }

    Alert.alert(
      'Elimina account',
      'Questa azione eliminerà il tuo accesso e rimuoverà i dati personali associati all’account. Alcuni dati di pagamento o prenotazione potranno essere conservati se richiesto dalla legge.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await deleteAccount(deletePassword);
              setDeletePassword('');
              setShowDeleteAccount(false);
              Alert.alert(
                'Account eliminato',
                'Il tuo account è stato eliminato. Potrai creare un nuovo account in futuro se vorrai tornare.',
                [{ text: 'OK', onPress: () => router.replace('/login') }],
              );
            } catch (error: any) {
              Alert.alert('Eliminazione non riuscita', error.message || 'Riprova più tardi.');
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleSendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Errore', 'Inserisci un numero di telefono valido');
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_URL}/auth/send-sms-verification`, {
        method: 'POST',
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      if (!response.ok) throw new Error('Errore invio codice');

      setCodeSent(true);
      Alert.alert('Codice inviato', 'Controlla gli SMS per completare la verifica.');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile inviare il codice.');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Errore', 'Inserisci un codice valido');
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_URL}/auth/verify-sms-code`, {
        method: 'POST',
        body: JSON.stringify({
          phone_number: phoneNumber,
          verification_code: verificationCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.message || 'Codice non valido');

      if (data?.user) {
        await updateUser(data.user);
      }

      setIsPhoneVerified(Boolean(data?.user?.phone_verified ?? true));
      setPhoneNumber(data?.user?.phone_number ?? phoneNumber);
      setShowPhoneVerification(false);
      setCodeSent(false);
      setVerificationCode('');
      Alert.alert('Verificato', 'Il numero di telefono è stato verificato.');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Verifica non riuscita');
    }
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const logoutScrollSpacer = Math.max(insets.bottom + 180, 220);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.header}>
          <View style={[styles.kicker, { backgroundColor: `${theme.primary}16`, borderColor: `${theme.primary}30` }]}>
            <IconSymbol name="person" size={12} color={theme.primary} />
            <Text style={[styles.kickerText, { color: theme.primary }]}>Profilo</Text>
          </View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Il tuo account</Text>
          <Text style={[styles.pageSubtitle, { color: theme.textTertiary }]}>
            Dati essenziali, notifiche e supporto.
          </Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <LinearGradient
            colors={[`${theme.primary}16`, 'rgba(0,0,0,0)', `${theme.secondary}10`] as [string, string, string]}
            style={styles.heroGlow}
          />
          <View style={styles.heroTopRow}>
            <LinearGradient
              colors={theme.gradientPrimary as [string, string]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{getInitials(user?.name || 'User')}</Text>
            </LinearGradient>

            <View style={styles.heroCopy}>
              <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                {user?.name || 'Utente'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                {user?.email || 'email@pierre.app'}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={[styles.metaPill, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
              <IconSymbol name={isPhoneVerified ? 'checkmark.circle' : 'phone'} size={14} color={isPhoneVerified ? theme.success : theme.textTertiary} />
              <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>
                {isPhoneVerified ? 'Telefono verificato' : 'Telefono da verificare'}
              </Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
              <IconSymbol name="bell.fill" size={14} color={theme.primary} />
              <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>Notifiche account</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Account</Text>

          <View style={[styles.cardGroup, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setShowPhoneVerification(prev => !prev)}
              style={[styles.rowButton, { borderBottomColor: showPhoneVerification ? theme.border : 'transparent' }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
                  <IconSymbol name="phone" size={18} color={theme.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Verifica telefono</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>
                    {isPhoneVerified ? 'Numero verificato' : 'Aggiungi e conferma il numero'}
                  </Text>
                </View>
              </View>
              <IconSymbol
                name={showPhoneVerification ? 'chevron.up' : 'chevron.right'}
                size={18}
                color={theme.textTertiary}
              />
            </TouchableOpacity>

            {showPhoneVerification ? (
              <View style={styles.expandArea}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="Numero di telefono"
                  placeholderTextColor={theme.textTertiary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  editable={!codeSent}
                />

                {!codeSent ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                    onPress={handleSendVerificationCode}
                  >
                    <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>Invia codice</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                      ]}
                      placeholder="Codice SMS"
                      placeholderTextColor={theme.textTertiary}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={styles.inlineButtons}>
                      <TouchableOpacity
                        style={[styles.primaryButton, styles.inlineButton, { backgroundColor: theme.success }]}
                        onPress={handleVerifyCode}
                      >
                        <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>Verifica</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.secondaryButton, styles.inlineButton, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}
                        onPress={handleSendVerificationCode}
                      >
                        <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Invia di nuovo</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setShowDeleteAccount(prev => !prev)}
              style={[styles.rowButton, { borderBottomColor: theme.border }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.error}16` }]}>
                  <IconSymbol name="xmark.circle.fill" size={18} color={theme.error} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Elimina account</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>
                    Rimuovi accesso e dati personali dal tuo account
                  </Text>
                </View>
              </View>
              <IconSymbol
                name={showDeleteAccount ? 'chevron.up' : 'chevron.right'}
                size={18}
                color={theme.textTertiary}
              />
            </TouchableOpacity>

            {showDeleteAccount ? (
              <View style={styles.expandArea}>
                <Text style={[styles.helperText, { color: theme.textTertiary }]}>
                  Conferma con la tua password. Se hai prenotazioni o pagamenti esistenti, conserveremo solo i dati strettamente necessari per obblighi amministrativi e contabili.
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="Password attuale"
                  placeholderTextColor={theme.textTertiary}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  editable={!deleteLoading}
                />
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.destructiveButton,
                    { backgroundColor: theme.error },
                    deleteLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator color={theme.textInverse} />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>
                      Elimina definitivamente
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleEnableNotifications}
              style={[styles.rowButton, { borderBottomColor: theme.border }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.info}18` }]}>
                  <IconSymbol name="bell.fill" size={18} color={theme.info} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Notifiche push</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>
                    {notifLoading ? 'Attivazione in corso...' : 'Aggiorna e riattiva le notifiche'}
                  </Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={18} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={styles.rowButton}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.secondary}18` }]}>
                  <IconSymbol name="clock.fill" size={18} color={theme.secondary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Promemoria eventi</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>
                    Ricevi un promemoria prima dell’evento
                  </Text>
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

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Supporto</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setShowThemeSelector(prev => !prev)}
              style={[styles.rowButton, { borderBottomColor: theme.border }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
                  <IconSymbol name="gearshape.fill" size={18} color={theme.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Tema app</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>
                    Cambia il look dell’app
                  </Text>
                </View>
              </View>
              <IconSymbol
                name={showThemeSelector ? 'chevron.up' : 'chevron.right'}
                size={18}
                color={theme.textTertiary}
              />
            </TouchableOpacity>

            {showThemeSelector ? (
              <View style={[styles.themeArea, { borderBottomColor: theme.border }]}>
                <ThemeSelector />
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => openExternalLink(SUPPORT_URL || 'mailto:support@pierre.app', 'il supporto')}
              style={[styles.rowButton, { borderBottomColor: theme.border }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
                  <IconSymbol name="envelope" size={18} color={theme.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Contatta il supporto</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>support@pierre.app</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={18} color={theme.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => openExternalLink(PRIVACY_POLICY_URL, 'la privacy policy')}
              style={[styles.rowButton, { borderBottomColor: theme.border }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.warning}18` }]}>
                  <IconSymbol name="doc.text" size={18} color={theme.warning} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Privacy policy</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>Versione app {appVersion}</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={18} color={theme.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => openExternalLink(TERMS_URL, 'i termini di servizio')}
              style={styles.rowButton}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.info}18` }]}>
                  <IconSymbol name="info.circle" size={18} color={theme.info} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Termini di servizio</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>Condizioni di utilizzo di Pierre</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: theme.error,
              borderColor: `${theme.error}CC`,
              shadowColor: theme.error,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.88}
        >
          <IconSymbol
            name="arrow.right.square.fill"
            size={18}
            color={theme.textInverse}
          />
          <Text style={[styles.logoutText, { color: theme.textInverse }]}>
            Esci dall’account
          </Text>
        </TouchableOpacity>

        <View style={{ height: logoutScrollSpacer }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 18,
  },
  kicker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    marginBottom: 22,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroCopy: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowButton: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  expandArea: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
  themeArea: {
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  primaryButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineButton: {
    flex: 1,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  destructiveButton: {
    marginTop: 2,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  logoutButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
