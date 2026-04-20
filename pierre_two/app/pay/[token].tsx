import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { trackEvent } from '../../config/analytics';

type Step = 'loading' | 'checkout' | 'paid' | 'full' | 'error';

interface SharePreview {
  amount: string;
  event_name: string;
  table_name: string;
  status: string;
  slots_filled: number;
  slots_total: number;
}

export default function GuestPaymentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { theme } = useTheme();

  const [step, setStep] = useState<Step>('loading');
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    loadPreview();
  }, [token]);

  const loadPreview = async () => {
    setStep('loading');
    trackEvent('guest_payment_preview_requested', {
      payment_link_token: token ?? null,
    });
    try {
      const res = await fetch(`${API_URL}/payment-links/${token}`);
      if (!res.ok) {
        trackEvent('guest_payment_preview_failed', {
          payment_link_token: token ?? null,
          status_code: res.status,
        });
        setErrorMsg('Link di pagamento non valido o scaduto.');
        setStep('error');
        return;
      }
      const data = await res.json();
      setPreview(data);
      trackEvent('guest_payment_preview_loaded', {
        payment_link_token: token ?? null,
        status: data.status,
        slots_filled: data.slots_filled,
        slots_total: data.slots_total,
      });
      if (data.status === 'full') {
        setStep('full');
      } else {
        setStep('checkout');
      }
    } catch {
      trackEvent('guest_payment_preview_failed', {
        payment_link_token: token ?? null,
        error_type: 'network',
      });
      setErrorMsg('Impossibile caricare i dettagli del pagamento.');
      setStep('error');
    }
  };

  const handlePay = async () => {
    if (!guestName.trim()) {
      Alert.alert('Errore', 'Inserisci il tuo nome.');
      return;
    }
    if (!guestPhone.trim()) {
      Alert.alert('Errore', 'Inserisci il tuo numero di telefono.');
      return;
    }
    setPayLoading(true);
    trackEvent('guest_payment_checkout_submitted', {
      payment_link_token: token ?? null,
      has_email: Boolean(guestEmail.trim()),
    });
    try {
      const res = await fetch(`${API_URL}/payment-links/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: guestName.trim(),
          phone: guestPhone.trim(),
          email: guestEmail.trim() || null,
        }),
      });
      if (res.status === 409) {
        trackEvent('guest_payment_checkout_rejected', {
          payment_link_token: token ?? null,
          reason: 'table_full',
        });
        setStep('full');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        trackEvent('guest_payment_checkout_failed', {
          payment_link_token: token ?? null,
          status_code: res.status,
          error_message: data.error || 'Impossibile avviare il pagamento.',
        });
        Alert.alert('Errore', data.error || 'Impossibile avviare il pagamento.');
        return;
      }
      const checkoutUrl = data.checkoutUrl || data.checkout_url;
      if (checkoutUrl) {
        trackEvent('guest_payment_checkout_redirected', {
          payment_link_token: token ?? null,
        });
        await Linking.openURL(checkoutUrl);
      }
    } catch {
      trackEvent('guest_payment_checkout_failed', {
        payment_link_token: token ?? null,
        error_type: 'network',
      });
      Alert.alert('Errore', 'Impossibile avviare il pagamento. Riprova.');
    } finally {
      setPayLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[s.loadingText, { color: theme.textTertiary }]}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <View style={[s.stateIconWrap, { backgroundColor: theme.errorLight }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={36} color={theme.error} />
          </View>
          <Text style={[s.stateTitle, { color: theme.text }]}>Link non valido</Text>
          <Text style={[s.stateBody, { color: theme.textTertiary }]}>{errorMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'paid') {
    return (
      <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <View style={[s.stateIconWrap, { backgroundColor: theme.successLight }]}>
            <IconSymbol name="checkmark.circle.fill" size={36} color={theme.success} />
          </View>
          <Text style={[s.stateTitle, { color: theme.text }]}>Pagamento completato</Text>
          <Text style={[s.stateBody, { color: theme.textTertiary }]}>Questa quota risulta gia pagata e non richiede altre azioni.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'full') {
    return (
      <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <View style={[s.stateIconWrap, { backgroundColor: theme.warningLight }]}>
            <IconSymbol name="xmark.circle.fill" size={36} color={theme.warning} />
          </View>
          <Text style={[s.stateTitle, { color: theme.text }]}>Tavolo al completo</Text>
          <Text style={[s.stateBody, { color: theme.textTertiary }]}>Tutti i posti disponibili per questo tavolo sono gia stati occupati.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View
            style={[
              s.heroCard,
              { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
            ]}
          >
            <LinearGradient
              colors={[`${theme.primary}30`, 'rgba(0,0,0,0)', `${theme.secondary}18`] as [string, string, string]}
              style={s.heroGlow}
            />

            <View style={s.brandRow}>
              <Text style={[s.wordmark, { color: theme.primary }]}>PIERRE</Text>
              <View style={[s.wordmarkDot, { backgroundColor: theme.primary }]} />
            </View>

            {preview && (
              <>
                <View style={[s.kickerPill, { backgroundColor: `${theme.primary}16`, borderColor: `${theme.primary}33` }]}>
                  <IconSymbol name="wineglass.fill" size={12} color={theme.primary} />
                  <Text style={[s.kickerText, { color: theme.primary }]}>Quota tavolo condivisa</Text>
                </View>

                <Text style={[s.eventName, { color: theme.text }]}>{preview.event_name}</Text>
                <Text style={[s.tableName, { color: theme.textSecondary }]}>{preview.table_name}</Text>

                <View style={s.heroStats}>
                  <View style={[s.amountCard, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                    <Text style={[s.amountLabel, { color: theme.textTertiary }]}>Da pagare</Text>
                    <Text style={[s.amount, { color: theme.primary }]}>{preview.amount}</Text>
                  </View>

                  <View style={[s.slotsCard, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                    <View style={[s.slotsBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <IconSymbol name="person.2.fill" size={13} color={theme.textTertiary} />
                      <Text style={[s.slotsText, { color: theme.textSecondary }]}>
                        {' '}{preview.slots_filled}/{preview.slots_total}
                      </Text>
                    </View>
                    <Text style={[s.slotsCaption, { color: theme.textTertiary }]}>posti gia confermati</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={[s.formCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: theme.text }]}>Completa il pagamento</Text>
              <Text style={[s.cardSubtitle, { color: theme.textTertiary }]}>
                Inserisci i tuoi dati. Ti reindirizzeremo a Stripe per il checkout sicuro.
              </Text>
            </View>

            <View style={s.fieldBlock}>
              <Text style={[s.label, { color: theme.textSecondary }]}>Nome <Text style={{ color: theme.primary }}>*</Text></Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.backgroundSurface, borderColor: theme.border, color: theme.text }]}
                placeholder="Il tuo nome"
                placeholderTextColor={theme.textTertiary}
                value={guestName}
                onChangeText={setGuestName}
                editable={!payLoading}
              />
            </View>

            <View style={s.fieldBlock}>
              <Text style={[s.label, { color: theme.textSecondary }]}>Telefono <Text style={{ color: theme.primary }}>*</Text></Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.backgroundSurface, borderColor: theme.border, color: theme.text }]}
                placeholder="+39 333 1234567"
                placeholderTextColor={theme.textTertiary}
                value={guestPhone}
                onChangeText={setGuestPhone}
                keyboardType="phone-pad"
                editable={!payLoading}
              />
            </View>

            <View style={s.fieldBlock}>
              <Text style={[s.label, { color: theme.textSecondary }]}>Email <Text style={[s.optionalTag, { color: theme.textTertiary }]}>(opzionale)</Text></Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.backgroundSurface, borderColor: theme.border, color: theme.text }]}
                placeholder="email@esempio.it"
                placeholderTextColor={theme.textTertiary}
                value={guestEmail}
                onChangeText={setGuestEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!payLoading}
              />
            </View>

            <View style={[s.reassuranceRow, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
              <View style={[s.reassuranceIcon, { backgroundColor: `${theme.success}18` }]}>
                <IconSymbol name="lock" size={14} color={theme.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.reassuranceTitle, { color: theme.text }]}>Checkout protetto</Text>
                <Text style={[s.reassuranceText, { color: theme.textTertiary }]}>Pagamento sicuro gestito da Stripe.</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.button, { backgroundColor: theme.primary }, payLoading && s.buttonDisabled]}
              onPress={handlePay}
              disabled={payLoading}
              activeOpacity={0.85}
            >
              {payLoading ? (
                <ActivityIndicator color={theme.textInverse} />
              ) : (
                <>
                  <Text style={[s.buttonEyebrow, { color: theme.textInverse }]}>Conferma quota</Text>
                  <Text style={[s.buttonText, { color: theme.textInverse }]}>Paga {preview?.amount || ''}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={[s.stripeBadge, { borderTopColor: theme.border }]}>
              <IconSymbol name="arrow.right.square.fill" size={12} color={theme.textTertiary} />
              <Text style={[s.stripeBadgeText, { color: theme.textTertiary }]}> Si apre il checkout Stripe in una pagina esterna</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 15 },

  stateIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stateTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  stateBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 8,
    paddingLeft: 8,
  },
  wordmarkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.7,
  },
  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  kickerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  eventName: { fontSize: 28, fontWeight: '800', marginBottom: 6, lineHeight: 34 },
  tableName: { fontSize: 15, marginBottom: 18 },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  amountCard: {
    flex: 1.2,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
  },
  amountLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  amount: { fontSize: 36, fontWeight: '800' },
  slotsCard: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  slotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  slotsText: { fontSize: 13, fontWeight: '700' },
  slotsCaption: { fontSize: 12, lineHeight: 18, marginTop: 12 },

  formCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
  },
  cardHeader: { marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, lineHeight: 19 },

  fieldBlock: { marginTop: 16 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  optionalTag: { fontWeight: '400' },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  reassuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 18,
  },
  reassuranceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassuranceTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  reassuranceText: { fontSize: 12, lineHeight: 17 },
  button: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', opacity: 0.8, marginBottom: 2 },
  buttonText: { fontSize: 18, fontWeight: '800' },

  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  stripeBadgeText: { fontSize: 12, textAlign: 'center' },
});
