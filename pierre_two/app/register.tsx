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
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";

type RegistrationStep = "info" | "phone-verification";

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
  const [isVerifying, setIsVerifying] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
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
    if (password.length < 6) {
      Alert.alert("Errore", "La password deve contenere almeno 6 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Errore", "Le password non coincidono");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
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
        if (response.status === 409) errorMessage = "Esiste già un account con questa email";
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
      setStep("phone-verification");
    } catch (error: any) {
      Alert.alert("Registrazione fallita", error.message || "Impossibile creare l'account");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Send verification code
  const handleSendVerificationCode = async () => {
    if (!tempUserId || !phone) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/send-sms-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: tempUserId,
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
      Alert.alert("Codice inviato", `Codice di verifica inviato al +39${phone.trim()}`);
    } catch (error: any) {
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
    if (!tempUserId || !phone) {
      Alert.alert("Errore", "Dati di registrazione mancanti. Ricomincia dall'inizio.");
      return;
    }
    if (!dateOfBirth) {
      Alert.alert("Errore", "Data di nascita mancante. Ricomincia dall'inizio.");
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`${API_URL}/auth/verify-sms-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: tempUserId,
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

      // Phone verified — complete registration and auto-login
      Alert.alert("Verificato!", "Numero confermato. Accesso in corso...", [
        {
          text: "OK",
          onPress: async () => {
            try {
              await register({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                phone_number: `+39${phone.trim()}`,
                date_of_birth: dateOfBirth.toISOString().split("T")[0],
              });
              router.replace("/(tabs)");
            } catch (err: any) {
              Alert.alert(
                "Errore di accesso",
                err.message || "Account creato ma accesso fallito. Effettua il login manualmente.",
              );
              router.replace("/login");
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Verifica fallita", error.message || "Codice non valido. Riprova.");
    } finally {
      setIsVerifying(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Not Set";
    return date.toLocaleDateString("en-US", {
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

  // Render different UI based on step
  if (step === "phone-verification") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text }]}>
              Verify Your Phone
            </Text>
            <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
              We'll send a verification code to +39 {phone}
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
                  Phone Number
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
                    {isLoading ? "Sending..." : "Send Verification Code"}
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
                    Enter the 6-digit code sent to your phone
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
                      {isVerifying ? "Verifying..." : "Verify & Complete"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendVerificationCode}
                    disabled={isLoading}
                  >
                    <Text style={[styles.resendText, { color: theme.primary }]}>
                      Didn't receive the code? Resend
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
                  ← Back to registration
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
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
            Sign up to get started
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
              placeholder="Full Name"
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
                {dateOfBirth ? formatDate(dateOfBirth) : "Date of Birth"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
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
              placeholder="Confirm Password"
              placeholderTextColor={theme.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
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
                {isLoading ? "Creating Account..." : "Continue →"}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.textTertiary }]}>
                Already have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  Log In
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
    backgroundColor: "#000",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    paddingLeft: 16,
  },
  phonePrefix: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#fff",
  },
  button: {
    backgroundColor: "#6C63FF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  footerText: {
    color: "#999",
    fontSize: 14,
  },
  linkText: {
    color: "#6C63FF",
    fontSize: 14,
    fontWeight: "600",
  },
  datePickerText: {
    color: "#fff",
    fontSize: 16,
  },
  datePickerPlaceholder: {
    color: "#999",
    fontSize: 16,
  },
  phoneDisplay: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#333",
  },
  phoneDisplayLabel: {
    color: "#999",
    fontSize: 14,
    marginBottom: 8,
  },
  phoneDisplayValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  instructionText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  codeInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    textAlign: "center",
    letterSpacing: 8,
    fontWeight: "600",
  },
  resendButton: {
    marginTop: 16,
    padding: 12,
  },
  resendText: {
    color: "#6C63FF",
    fontSize: 14,
    textAlign: "center",
  },
  backButton: {
    marginTop: 24,
    padding: 12,
  },
});
