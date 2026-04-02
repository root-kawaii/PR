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
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { API_URL } from '../../config/api';

type Step = 'loading' | 'preview' | 'verify' | 'checkout' | 'paid' | 'error';

interface SharePreview {
  amount: number;
  event_name: string;
  table_name: string;
  status: string;
  guest_name?: string;
}

export default function GuestPaymentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const [step, setStep] = useState<Step>('loading');
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [phone, setPhone] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [guestName, setGuestName] = useState('');
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
      if (data.status === 'paid') {
        setStep('paid');
      } else {
        setStep('preview');
      }
    } catch {
      setErrorMsg('Impossibile caricare i dettagli del pagamento.');
      setStep('error');
    }
  };

  const handleVerify = async () => {
    if (!phone.trim()) {
      Alert.alert('Errore', 'Inserisci il numero di telefono.');
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch(`${API_URL}/payment-links/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Errore', data.error || 'Verifica fallita. Assicurati che il numero sia corretto.');
        return;
      }
      setVerifyToken(data.token);
      if (data.guest_name) setGuestName(data.guest_name);
      setStep('checkout');
    } catch {
      Alert.alert('Errore', 'Impossibile connettersi al server. Riprova.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handlePay = async () => {
    setPayLoading(true);
    try {
      const res = await fetch(`${API_URL}/payment-links/${token}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${verifyToken}`,
        },
        body: JSON.stringify({
          name: guestName.trim() || undefined,
          email: guestEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Errore', data.error || 'Impossibile avviare il pagamento.');
        return;
      }
      await Linking.openURL(data.checkout_url);
    } catch {
      Alert.alert('Errore', 'Impossibile avviare il pagamento. Riprova.');
    } finally {
      setPayLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Link non valido</Text>
        <Text style={styles.errorBody}>{errorMsg}</Text>
      </View>
    );
  }

  if (step === 'paid') {
    return (
      <View style={styles.center}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Pagamento completato</Text>
        <Text style={styles.body}>Questo pagamento è già stato effettuato.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pagamento Tavolo</Text>
          {preview && (
            <>
              <Text style={styles.eventName}>{preview.event_name}</Text>
              <Text style={styles.tableName}>{preview.table_name}</Text>
              <Text style={styles.amount}>€{Number(preview.amount).toFixed(2)}</Text>
            </>
          )}
        </View>

        {/* Verify step */}
        {step === 'preview' || step === 'verify' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verifica il tuo numero</Text>
            <Text style={styles.cardSubtitle}>
              Inserisci il numero di telefono con cui sei stato invitato.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="+39 333 123 4567"
              placeholderTextColor="#6b7280"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
              editable={!verifyLoading}
            />
            <TouchableOpacity
              style={[styles.button, verifyLoading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={verifyLoading}
            >
              {verifyLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Verifica</Text>
              }
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Checkout step */}
        {step === 'checkout' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paga la tua quota</Text>
            <Text style={styles.cardSubtitle}>
              Verrai reindirizzato a Stripe per completare il pagamento in modo sicuro.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Nome (opzionale)"
              placeholderTextColor="#6b7280"
              value={guestName}
              onChangeText={setGuestName}
              editable={!payLoading}
            />
            <TextInput
              style={styles.input}
              placeholder="Email per ricevuta (opzionale)"
              placeholderTextColor="#6b7280"
              value={guestEmail}
              onChangeText={setGuestEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!payLoading}
            />
            <TouchableOpacity
              style={[styles.button, payLoading && styles.buttonDisabled]}
              onPress={handlePay}
              disabled={payLoading}
            >
              {payLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Paga €{preview ? Number(preview.amount).toFixed(2) : ''}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLink} onPress={() => setStep('preview')}>
              <Text style={styles.backLinkText}>← Indietro</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  center: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 15,
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorBody: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  successIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  successTitle: {
    color: '#4ade80',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  headerTitle: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  eventName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  tableName: {
    color: '#9ca3af',
    fontSize: 15,
    marginBottom: 16,
  },
  amount: {
    color: '#ec4899',
    fontSize: 40,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#262626',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#ec4899',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLinkText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  body: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
  },
});
