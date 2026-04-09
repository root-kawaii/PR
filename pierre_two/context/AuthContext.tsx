import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types';
import { API_URL } from '../config/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// expo-secure-store and expo-notifications are only available in native builds (not Expo Go).
// Fall back gracefully so the app works during local development.
let SecureStore: typeof import('expo-secure-store') | null = null;
try { SecureStore = require('expo-secure-store'); } catch { /* Expo Go */ }
const _memStore: Record<string, string> = {};

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go */ }

if (Notifications) {
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

async function registerPushToken(authToken: string): Promise<void> {
  if (!Notifications) {
    console.log('[PushToken] Skipped: expo-notifications not available (Expo Go)');
    return;
  }
  if (!Constants.isDevice) {
    console.log('[PushToken] Skipped: not a physical device');
    return;
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
    return;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('[PushToken] Using projectId:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    console.log('[PushToken] Token obtained:', tokenData.data);
    const res = await fetch(`${API_URL}/auth/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ push_token: tokenData.data }),
    });
    console.log('[PushToken] Server response:', res.status);
  } catch (e) {
    console.error('[PushToken] Failed to register push token:', e);
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
}

/** Extract a human-readable message from a failed response (handles JSON or plain text). */
async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return fallback;
    const json = JSON.parse(text);
    return json.error || json.message || fallback;
  } catch {
    return fallback;
  }
}

/** Parse a successful response as JSON, throwing a clean error if it fails. */
async function safeJson<T>(response: Response, fallback: string): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(fallback);
  }
}

/** Decode JWT exp claim without a library — returns null if unparseable. */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return false; // can't determine — assume valid
  return Date.now() / 1000 >= exp;
}

async function secureGet(key: string): Promise<string | null> {
  if (!SecureStore) return _memStore[key] ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (!SecureStore) { _memStore[key] = value; return; }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (!SecureStore) { delete _memStore[key]; return; }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore if key doesn't exist
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      const [savedToken, savedUser] = await Promise.all([
        secureGet(TOKEN_KEY),
        secureGet(USER_KEY),
      ]);

      if (savedToken && savedUser) {
        if (isTokenExpired(savedToken)) {
          // Token expired — clear storage and start fresh
          await Promise.all([secureDelete(TOKEN_KEY), secureDelete(USER_KEY)]);
        } else {
          try {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
          } catch {
            // Corrupt stored data — clear and force re-login
            await Promise.all([secureDelete(TOKEN_KEY), secureDelete(USER_KEY)]);
          }
        }
      }
    } catch {
      // Storage read failed — start unauthenticated
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    await Promise.all([secureDelete(TOKEN_KEY), secureDelete(USER_KEY)]);
  }, []);

  const login = async (credentials: LoginRequest) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('Connessione scaduta. Controlla la tua rete e riprova.');
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response, 'Login failed'));
    }

    const data: AuthResponse = await safeJson(response, 'Login failed');

    setUser(data.user);
    setToken(data.token);
    await Promise.all([
      secureSet(TOKEN_KEY, data.token),
      secureSet(USER_KEY, JSON.stringify(data.user)),
    ]);
    registerPushToken(data.token);
  };

  const register = async (data: RegisterRequest) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response, 'Registration failed'));
    }

    const authData: AuthResponse = await safeJson(response, 'Registration failed');

    setUser(authData.user);
    setToken(authData.token);
    await Promise.all([
      secureSet(TOKEN_KEY, authData.token),
      secureSet(USER_KEY, JSON.stringify(authData.user)),
    ]);
    registerPushToken(authData.token);
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
