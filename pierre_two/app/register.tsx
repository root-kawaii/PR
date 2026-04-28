import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { trackEvent } from "../config/analytics";
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";

type RegistrationStep = "info" | "phone-verification";

const withAlpha = (hexColor: string, alpha: string) =>
  /^#([0-9a-f]{6})$/i.test(hexColor) ? `${hexColor}${alpha}` : hexColor;

export default function RegisterScreen() {
  const API_URL = Constants.expoConfig?.extra?.apiUrl;

  // Step management
  const [step, setStep] = useState<RegistrationStep>("info");

  // User info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Phone verification
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [tempAuthToken, setTempAuthToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // Step 1: Validate and create account (without phone verification yet)
  const handleContinueToPhoneVerification = async () => {
    if (!name.trim()) {
      Alert.alert("Errore", "Inserisci il tuo nome completo");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Errore", "Inserisci un indirizzo email valido");
      return;
    }
    if (!dateOfBirth) {
      Alert.alert("Errore", "Seleziona la tua data di nascita");
      return;
    }
    // Italian mobile: starts with 3, 9-10 digits (e.g. 3331234567)
    const italianMobileRegex = /^3\d{8,9}$/;
    if (!italianMobileRegex.test(phone.trim())) {
      Alert.alert("Errore", "Inserisci un numero di cellulare italiano valido (es. 3331234567)");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Errore", "La password deve contenere almeno 8 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Errore", "Le password non coincidono");
      return;
    }

    setIsLoading(true);
    try {
      trackEvent("registration_account_create_submitted");
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone_number: `+39${phone.trim()}`,
          date_of_birth: dateOfBirth.toISOString().split("T")[0],
        }),
      });

      let errorMessage = "Registrazione fallita";
      if (!response.ok) {
        try {
          const text = await response.text();
          if (text) {
            const json = JSON.parse(text);
            errorMessage = json.error || json.message || errorMessage;
          }
        } catch { /* use fallback */ }
        if (response.status === 409 && errorMessage === "Registrazione fallita") errorMessage = "Esiste già un account con questa email o numero di telefono";
        throw new Error(errorMessage);
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error("Risposta non valida dal server");
      }

      if (!data?.user?.id) {
        throw new Error("Risposta non valida dal server");
      }

      setTempUserId(data.user.id);
      setTempAuthToken(data.token);
      trackEvent("registration_account_created", {
        user_id: data.user.id,
      });
      setStep("phone-verification");
    } catch (error: any) {
      trackEvent("registration_account_create_failed", {
        error_message: error.message || "unknown_error",
      });
      Alert.alert("Registrazione fallita", error.message || "Impossibile creare l'account");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Send verification code
  const handleSendVerificationCode = async () => {
    if (!tempAuthToken || !phone) return;

    setIsLoading(true);
    try {
      trackEvent("registration_phone_verification_requested", {
        user_id: tempUserId,
      });
      const response = await fetch(`${API_URL}/auth/send-sms-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempAuthToken}`,
        },
        body: JSON.stringify({
          phone_number: `+39${phone.trim()}`,
        }),
      });

      if (!response.ok) {
        let msg = "Invio del codice fallito";
        try {
          const text = await response.text();
          if (text) {
            const json = JSON.parse(text);
            msg = json.error || json.message || msg;
          }
        } catch { /* use fallback */ }
        throw new Error(msg);
      }

      setCodeSent(true);
      trackEvent("registration_phone_verification_sent", {
        user_id: tempUserId,
      });
      Alert.alert("Codice inviato", `Codice di verifica inviato al +39${phone.trim()}`);
    } catch (error: any) {
      trackEvent("registration_phone_verification_send_failed", {
        user_id: tempUserId,
        error_message: error.message || "unknown_error",
      });
      Alert.alert("Errore", error.message || "Impossibile inviare il codice. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify code and complete registration
  const handleVerifyAndCompleteRegistration = async () => {
    if (!verificationCode || verificationCode.trim().length !== 6) {
      Alert.alert("Errore", "Inserisci il codice a 6 cifre");
      return;
    }
    if (!tempAuthToken || !phone) {
      Alert.alert("Errore", "Dati di registrazione mancanti. Ricomincia dall'inizio.");
      return;
    }
    if (!dateOfBirth) {
      Alert.alert("Errore", "Data di nascita mancante. Ricomincia dall'inizio.");
      return;
    }

    setIsVerifying(true);
    try {
      trackEvent("registration_phone_verification_submitted", {
        user_id: tempUserId,
      });
      const response = await fetch(`${API_URL}/auth/verify-sms-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempAuthToken}`,
        },
        body: JSON.stringify({
          phone_number: `+39${phone.trim()}`,
          verification_code: verificationCode.trim(),
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error("Risposta non valida dal server");
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Verifica fallita");
      }
      if (!data.verified) {
        throw new Error("Codice non valido o scaduto. Richiedi un nuovo codice.");
      }

      // Phone verified — log in with existing credentials (account already created in step 1)
      setIsVerifying(false);
      try {
        await login({
          email: email.trim().toLowerCase(),
          password,
        });
        setTempAuthToken(null);
        trackEvent("registration_completed", {
          user_id: tempUserId,
        });
        router.replace("/(tabs)");
      } catch (err: any) {
        trackEvent("registration_auto_login_failed", {
          user_id: tempUserId,
          error_message: err.message || "unknown_error",
        });
        Alert.alert(
          "Errore di accesso",
          err.message || "Account creato ma accesso fallito. Effettua il login manualmente.",
        );
        router.replace("/login");
      }
    } catch (error: any) {
      trackEvent("registration_phone_verification_failed", {
        user_id: tempUserId,
        error_message: error.message || "unknown_error",
      });
      Alert.alert("Verifica fallita", error.message || "Codice non valido. Riprova.");
      setIsVerifying(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Non impostata";
    return date.toLocaleDateString("it-IT", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  const stepBar = (
    <View style={styles.stepBarContainer}>
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, { backgroundColor: theme.primary }]} />
        <View style={[styles.stepLine, { backgroundColor: step === 'phone-verification' ? theme.primary : theme.border }]} />
        <View style={[styles.stepDot, { backgroundColor: step === 'phone-verification' ? theme.primary : theme.border }]} />
      </View>
      <View style={styles.stepLabels}>
        <Text style={[styles.stepLabel, { color: theme.primary }]}>Dati</Text>
        <Text style={[styles.stepLabel, { color: step === 'phone-verification' ? theme.primary : theme.textTertiary }]}>Verifica</Text>
      </View>
    </View>
  );

  // Render different UI based on step
  if (step === "phone-verification") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View
            style={[
              styles.content,
              {
                backgroundColor: theme.cardBackground,
                borderColor: withAlpha(theme.border, "A6"),
                shadowColor: theme.background,
              },
            ]}
          >
            <View style={styles.brandContainer}>
              <Text style={[styles.wordmark, { color: theme.primary }]}>PIERRE</Text>
              <View style={[styles.wordmarkLine, { backgroundColor: theme.primary }]} />
            </View>
            {stepBar}
            <Text style={[styles.title, { color: theme.text }]}>
              Verifica Telefono
            </Text>
            <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
              Invieremo un codice a +39 {phone}
            </Text>

            <View style={styles.form}>
              <View
                style={[
                  styles.phoneDisplay,
                  {
                    backgroundColor: theme.backgroundElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.phoneDisplayLabel,
                    { color: theme.textTertiary },
                  ]}
                >
                  Numero di telefono
                </Text>
                <Text style={[styles.phoneDisplayValue, { color: theme.text }]}>
                  +39 {phone}
                </Text>
              </View>

              {!codeSent ? (
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: theme.primary },
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleSendVerificationCode}
                  disabled={isLoading}
                >
                  <Text
                    style={[styles.buttonText, { color: theme.textInverse }]}
                  >
                    {isLoading ? "Invio in corso..." : "Invia codice di verifica"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text
                    style={[
                      styles.instructionText,
                      { color: theme.textTertiary },
                    ]}
                  >
                    Inserisci il codice a 6 cifre inviato al tuo telefono
                  </Text>

                  <TextInput
                    style={[
                      styles.codeInput,
                      {
                        backgroundColor: theme.backgroundElevated,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="000000"
                    placeholderTextColor={theme.textTertiary}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isVerifying}
                  />

                  <TouchableOpacity
                    style={[
                      styles.button,
                      { backgroundColor: theme.primary },
                      (isVerifying || verificationCode.length !== 6) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={handleVerifyAndCompleteRegistration}
                    disabled={isVerifying || verificationCode.length !== 6}
                  >
                    <Text
                      style={[styles.buttonText, { color: theme.textInverse }]}
                    >
                      {isVerifying ? "Verifica in corso..." : "Verifica e completa"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendVerificationCode}
                    disabled={isLoading}
                  >
                    <Text style={[styles.resendText, { color: theme.primary }]}>
                      Non hai ricevuto il codice? Invia di nuovo
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setStep("info");
                  setCodeSent(false);
                  setVerificationCode("");
                }}
              >
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  ← Torna alla registrazione
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 1: Basic Info
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.content,
            {
              backgroundColor: theme.cardBackground,
              borderColor: withAlpha(theme.border, "A6"),
              shadowColor: theme.background,
            },
          ]}
        >
          <View style={styles.brandContainer}>
            <Text style={[styles.wordmark, { color: theme.primary }]}>PIERRE</Text>
            <View style={[styles.wordmarkLine, { backgroundColor: theme.primary }]} />
          </View>
          {stepBar}
          <Text style={[styles.title, { color: theme.text }]}>
            Crea Account
          </Text>
          <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
            Registrati per iniziare
          </Text>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Nome e cognome"
              placeholderTextColor={theme.textTertiary}
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElevated,
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

            <View
              style={[
                styles.phoneInputContainer,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.phonePrefix, { color: theme.text }]}>
                +39
              </Text>
              <TextInput
                style={[styles.phoneInput, { color: theme.text }]}
                placeholder="3935130925"
                placeholderTextColor={theme.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setShowDatePicker(true)}
              disabled={isLoading}
            >
              <Text
                style={
                  dateOfBirth
                    ? [styles.datePickerText, { color: theme.text }]
                    : [
                        styles.datePickerPlaceholder,
                        { color: theme.textTertiary },
                      ]
                }
              >
                {dateOfBirth ? formatDate(dateOfBirth) : "Data di nascita"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <View style={[styles.datePickerWrapper, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                <DateTimePicker
                  value={dateOfBirth || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                  maximumDate={new Date()}
                  textColor={theme.text}
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={[styles.dateConfirmButton, { backgroundColor: theme.primary }]}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={[styles.dateConfirmText, { color: theme.textInverse }]}>Conferma</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!isLoading}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Conferma Password"
              placeholderTextColor={theme.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleContinueToPhoneVerification}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, { color: theme.textInverse }]}>
                {isLoading ? "Creazione account..." : "Continua →"}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.textTertiary }]}>
                Hai gia un account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  Accedi
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    margin: 24,
    borderRadius: 28,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  wordmark: {
    fontSize: 24,
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
  stepBarContainer: {
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
    maxWidth: 80,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 6,
    width: 120,
    alignSelf: 'center',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 22,
    textAlign: "center",
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
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 16,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  button: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  datePickerText: {
    fontSize: 16,
  },
  datePickerPlaceholder: {
    fontSize: 16,
  },
  phoneDisplay: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  phoneDisplayLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  phoneDisplayValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  instructionText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  codeInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    borderWidth: 1,
    textAlign: "center",
    letterSpacing: 8,
    fontWeight: "600",
  },
  resendButton: {
    marginTop: 16,
    padding: 12,
  },
  resendText: {
    fontSize: 14,
    textAlign: "center",
  },
  backButton: {
    marginTop: 24,
    padding: 12,
  },
  datePickerWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dateConfirmButton: {
    margin: 12,
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
