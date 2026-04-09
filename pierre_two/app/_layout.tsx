import { ThemeProvider as NavigationThemeProvider, Theme } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go */ }

import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

const stripePublishableKey = Constants.expoConfig?.extra?.stripePublishableKey || '';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!isAuthenticated && inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && !inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  // Navigate to reservations tab when user taps a push notification
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (isAuthenticated) {
        router.push('/(tabs)/reservations');
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Block rendering until auth state is resolved — prevents flash of protected screens
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Create navigation theme from app theme
  const navigationTheme: Theme = useMemo(() => ({
    dark: theme.statusBarStyle === 'light',
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.cardBackground,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
    fonts: {
      regular: {
        fontFamily: 'System',
        fontWeight: '400',
      },
      medium: {
        fontFamily: 'System',
        fontWeight: '500',
      },
      bold: {
        fontFamily: 'System',
        fontWeight: '700',
      },
      heavy: {
        fontFamily: 'System',
        fontWeight: '900',
      },
    },
  }), [theme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ gestureEnabled: true, gestureDirection: 'horizontal' }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={theme.statusBarStyle} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </StripeProvider>
  );
}
