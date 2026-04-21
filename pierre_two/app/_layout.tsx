import { ThemeProvider as NavigationThemeProvider, Theme } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { PostHogProvider } from 'posthog-react-native';
let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go */ }

import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import {
  analyticsEnabled,
  buildScreenName,
  posthogClient,
  trackEvent,
  trackScreen,
} from '../config/analytics';

const stripePublishableKey = Constants.expoConfig?.extra?.stripePublishableKey || '';
const stripeUrlScheme =
  Constants.appOwnership === 'expo'
    ? Linking.createURL('/--/')
    : Linking.createURL('');

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const previousScreenNameRef = useRef<string | null>(null);
  const inTabsGroup = segments[0] === '(tabs)';
  const shouldRedirectToLogin = !isLoading && !isAuthenticated && inTabsGroup;
  const shouldRedirectToTabs = !isLoading && isAuthenticated && !inTabsGroup;
  const screenName = useMemo(() => buildScreenName(segments), [segments]);

  useEffect(() => {
    if (isLoading) return;

    if (shouldRedirectToLogin) {
      router.replace('/login');
    } else if (shouldRedirectToTabs) {
      router.replace('/(tabs)');
    }
  }, [isLoading, router, shouldRedirectToLogin, shouldRedirectToTabs]);

  useEffect(() => {
    if (isLoading || shouldRedirectToLogin || shouldRedirectToTabs) {
      return;
    }

    if (previousScreenNameRef.current === screenName) {
      return;
    }

    trackScreen(screenName);
    previousScreenNameRef.current = screenName;
  }, [isLoading, screenName, shouldRedirectToLogin, shouldRedirectToTabs]);

  // Navigate to reservations tab when user taps a push notification
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      trackEvent('push_notification_opened', {
        target_screen: '/reservations',
      });
      if (isAuthenticated) {
        router.push('/(tabs)/reservations');
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

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

  // Block rendering until auth state is resolved — prevents flash of protected screens
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

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

function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!analyticsEnabled || !posthogClient) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      client={posthogClient}
      autocapture={{
        captureTouches: false,
        captureScreens: false,
      }}
    >
      {children}
    </PostHogProvider>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey={stripePublishableKey}
      urlScheme={stripeUrlScheme}
    >
      <AnalyticsProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </ThemeProvider>
      </AnalyticsProvider>
    </StripeProvider>
  );
}
