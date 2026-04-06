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
import { API_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';
import { IconSymbol } from '../../components/ui/icon-symbol';

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
    try {
      const res = await fetch(`${API_URL}/payment-links/${token}`);
      if (!res.ok) {
        setErrorMsg('Link di pagamento non valido o scaduto.');
        setStep('error');
        return;
      }
      const data = await res.json();
      setPreview(data);
      if (data.status === 'full') {
        setStep('full');
      } else {
        setStep('checkout');
      }
    } catch {
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
        setStep('full');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Errore', data.error || 'Impossibile avviare il pagamento.');
        return;
      }
      const checkoutUrl = data.checkoutUrl || data.checkout_url;
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      }
    } catch {
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
          <Text style={[s.stateBody, { color: theme.textTertiary }]}>Questo pagamento è già stato effettuato.</Text>
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
          <Text style={[s.stateBody, { color: theme.textTertiary }]}>Tutti i posti sono stati occupati.</Text>
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
          {/* Brand */}
          <View style={s.brandRow}>
            <Text style={[s.wordmark, { color: theme.primary }]}>PIERRE</Text>
            <View style={[s.wordmarkDot, { backgroundColor: theme.primary }]} />
          </View>

          {/* Event info */}
          <View style={s.header}>
            {preview && (
              <>
                <Text style={[s.eventName, { color: theme.text }]}>{preview.event_name}</Text>
                <Text style={[s.tableName, { color: theme.textTertiary }]}>{preview.table_name}</Text>
                <Text style={[s.amount, { color: theme.primary }]}>{preview.amount}</Text>
                <View style={[s.slotsBadge, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                  <IconSymbol name="person.2.fill" size={13} color={theme.textTertiary} />
                  <Text style={[s.slotsText, { color: theme.textTertiary }]}>
                    {' '}{preview.slots_filled}/{preview.slots_total} posti occupati
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Checkout form */}
          <View style={[s.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Paga la tua quota</Text>
            <Text style={[s.cardSubtitle, { color: theme.textTertiary }]}>
              Inserisci i tuoi dati e verrai reindirizzato a Stripe per completare il pagamento in modo sicuro.
            </Text>

            <Text style={[s.label, { color: theme.textSecondary }]}>Nome <Text style={{ color: theme.primary }}>*</Text></Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.backgroundSurface, borderColor: theme.border, color: theme.text }]}
              placeholder="Il tuo nome"
              placeholderTextColor={theme.textTertiary}
              value={guestName}
              onChangeText={setGuestName}
              editable={!payLoading}
            />

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

            <Text style={[s.label, { color: theme.textSecondary }]}>Email <Text style={[s.optionalTag, { color: theme.textTertiary }]}>(per ricevuta)</Text></Text>
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

            <TouchableOpacity
              style={[s.button, { backgroundColor: theme.primary }, payLoading && s.buttonDisabled]}
              onPress={handlePay}
              disabled={payLoading}
              activeOpacity={0.8}
            >
              {payLoading
                ? <ActivityIndicator color={theme.textInverse} />
                : <Text style={[s.buttonText, { color: theme.textInverse }]}>Paga {preview?.amount || ''}</Text>
              }
            </TouchableOpacity>

            <View style={[s.stripeBadge, { borderTopColor: theme.border }]}>
              <IconSymbol name="lock" size={12} color={theme.textTertiary} />
              <Text style={[s.stripeBadgeText, { color: theme.textTertiary }]}> Pagamento sicuro via Stripe</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
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

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 24,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 10,
    paddingLeft: 10,
  },
  wordmarkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.7,
  },

  header: { alignItems: 'center', paddingBottom: 28 },
  eventName: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  tableName: { fontSize: 14, marginBottom: 12 },
  amount: { fontSize: 42, fontWeight: '800', marginBottom: 12 },
  slotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  slotsText: { fontSize: 13 },

  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: 20 },

  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  optionalTag: { fontWeight: '400' },
  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontSize: 16, fontWeight: '700' },

  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  stripeBadgeText: { fontSize: 12 },
});
