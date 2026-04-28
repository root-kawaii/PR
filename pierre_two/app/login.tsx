import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const withAlpha = (hexColor: string, alpha: string) =>
  /^#([0-9a-f]{6})$/i.test(hexColor) ? `${hexColor}${alpha}` : hexColor;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Compila email e password per continuare.');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(
        'Accesso non riuscito',
        error.message || 'Email o password non valide.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.authCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: withAlpha(theme.border, 'A6'),
              shadowColor: theme.background,
            },
          ]}
        >
          <View style={styles.brandContainer}>
            <Text style={[styles.wordmark, { color: theme.primary }]}>PIERRE</Text>
            <View style={[styles.wordmarkLine, { backgroundColor: theme.primary }]} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Bentornato</Text>
          <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
            Accedi per scoprire eventi, tavoli e acquisti della tua prossima
            serata.
          </Text>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={theme.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityState={{ disabled: isLoading }}
              activeOpacity={0.88}
            >
              <Text style={[styles.buttonText, { color: theme.textInverse }]}>
                {isLoading ? 'Accesso in corso...' : 'Accedi'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.textTertiary }]}>
                Non hai ancora un account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  Registrati
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  authCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 12,
    paddingLeft: 12,
  },
  wordmarkLine: {
    width: 28,
    height: 1,
    marginTop: 10,
    opacity: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 22,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
