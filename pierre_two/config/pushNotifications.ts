import { Platform } from 'react-native';
import Constants from 'expo-constants';

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go */ }

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'unsupported' }
  | { status: 'simulator' }
  | { status: 'denied' };

export function configureNotificationHandler(): void {
  if (!Notifications) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerPushToken(
  apiUrl: string,
  authToken: string,
): Promise<PushRegistrationResult> {
  if (!Notifications) {
    console.log('[PushToken] Skipped: expo-notifications not available (Expo Go)');
    return { status: 'unsupported' };
  }

  if (!Constants.isDevice) {
    console.log('[PushToken] Skipped: not a physical device');
    return { status: 'simulator' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  console.log('[PushToken] Permission status:', existingStatus);

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[PushToken] Permission after request:', status);
  }

  if (finalStatus !== 'granted') {
    console.log('[PushToken] Permission denied — token not registered');
    return { status: 'denied' };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  console.log('[PushToken] Using projectId:', projectId);
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  console.log('[PushToken] Token obtained:', tokenData.data);

  const res = await fetch(`${apiUrl}/auth/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ push_token: tokenData.data }),
  });
  console.log('[PushToken] Server response:', res.status);

  if (!res.ok) {
    throw new Error(`Push token registration failed with status ${res.status}`);
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return { status: 'registered', token: tokenData.data };
}
