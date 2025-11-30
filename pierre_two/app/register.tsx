import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_URL = 'http://172.20.10.5:3000';

type RegistrationStep = 'info' | 'phone-verification';

export default function RegisterScreen() {
  // Step management
  const [step, setStep] = useState<RegistrationStep>('info');

  // User info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Phone verification
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  // Step 1: Validate and create account (without phone verification yet)
  const handleContinueToPhoneVerification = async () => {
    // Validation
    if (!name || !email || !password || !dateOfBirth || !phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Validate phone number (must be 10 digits for Italian numbers)
    if (phone.length < 8) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      // Create the account first
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          date_of_birth: dateOfBirth.toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store temp user ID for phone verification
      setTempUserId(data.user.id);

      // Move to phone verification step
      setStep('phone-verification');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not create account');
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: tempUserId,
          phone_number: `+39${phone.trim()}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }

      setCodeSent(true);
      Alert.alert('Success', 'Verification code sent to your phone!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify code and complete registration
  const handleVerifyAndCompleteRegistration = async () => {
    if (!tempUserId || !phone || !verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`${API_URL}/auth/verify-sms-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: tempUserId,
          phone_number: `+39${phone.trim()}`,
          verification_code: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.verified) {
        throw new Error(data.message || 'Invalid verification code');
      }

      // Phone verified! Now complete the login
      Alert.alert('Success', 'Phone verified! Logging you in...', [
        {
          text: 'OK',
          onPress: async () => {
            try {
              await register({
                name: name.trim(),
                email: email.trim(),
                password,
                phone_number: `+39${phone.trim()}`,
                date_of_birth: dateOfBirth!.toISOString().split('T')[0],
              });
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Error', 'Account created but login failed. Please log in manually.');
              router.replace('/');
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Not Set';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  // Render different UI based on step
  if (step === 'phone-verification') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Verify Your Phone</Text>
            <Text style={styles.subtitle}>
              We'll send a verification code to +39 {phone}
            </Text>

            <View style={styles.form}>
              <View style={styles.phoneDisplay}>
                <Text style={styles.phoneDisplayLabel}>Phone Number</Text>
                <Text style={styles.phoneDisplayValue}>+39 {phone}</Text>
              </View>

              {!codeSent ? (
                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleSendVerificationCode}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>
                    {isLoading ? 'Sending...' : 'Send Verification Code'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.instructionText}>
                    Enter the 6-digit code sent to your phone
                  </Text>

                  <TextInput
                    style={styles.codeInput}
                    placeholder="000000"
                    placeholderTextColor="#999"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isVerifying}
                  />

                  <TouchableOpacity
                    style={[styles.button, (isVerifying || verificationCode.length !== 6) && styles.buttonDisabled]}
                    onPress={handleVerifyAndCompleteRegistration}
                    disabled={isVerifying || verificationCode.length !== 6}
                  >
                    <Text style={styles.buttonText}>
                      {isVerifying ? 'Verifying...' : 'Verify & Complete'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendVerificationCode}
                    disabled={isLoading}
                  >
                    <Text style={styles.resendText}>
                      Didn't receive the code? Resend
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setStep('info');
                  setCodeSent(false);
                  setVerificationCode('');
                }}
              >
                <Text style={styles.linkText}>← Back to registration</Text>
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />

            <View style={styles.phoneInputContainer}>
              <Text style={styles.phonePrefix}>+39</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="3935130925"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
              disabled={isLoading}
            >
              <Text style={dateOfBirth ? styles.datePickerText : styles.datePickerPlaceholder}>
                {dateOfBirth ? formatDate(dateOfBirth) : 'Date of Birth'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleContinueToPhoneVerification}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Creating Account...' : 'Continue →'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkText}>Log In</Text>
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
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    paddingLeft: 16,
  },
  phonePrefix: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#999',
    fontSize: 14,
  },
  linkText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerText: {
    color: '#fff',
    fontSize: 16,
  },
  datePickerPlaceholder: {
    color: '#999',
    fontSize: 16,
  },
  phoneDisplay: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  phoneDisplayLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  phoneDisplayValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  instructionText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  codeInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    padding: 12,
  },
  resendText: {
    color: '#6C63FF',
    fontSize: 14,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    padding: 12,
  },
});