import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types';
import { API_URL } from '../config/api';
import { identifyAnalyticsUser, resetAnalytics, trackEvent } from '../config/analytics';
import { configureNotificationHandler, registerPushToken } from '../config/pushNotifications';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// expo-secure-store and expo-notifications are only available in native builds (not Expo Go).
// Fall back gracefully so the app works during local development.
let SecureStore: typeof import('expo-secure-store') | null = null;
try { SecureStore = require('expo-secure-store'); } catch { /* Expo Go */ }
const _memStore: Record<string, string> = {};

configureNotificationHandler();

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
  deleteAccount: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (nextUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousAnalyticsUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadAuthData();
  }, []);

  useEffect(() => {
    if (!user) {
      if (previousAnalyticsUserIdRef.current) {
        resetAnalytics();
        previousAnalyticsUserIdRef.current = null;
      }
      return;
    }

    identifyAnalyticsUser(user);
    previousAnalyticsUserIdRef.current = user.id;
  }, [user]);

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
    if (user) {
      trackEvent('auth_logout', {
        user_id: user.id,
      });
    }
    setUser(null);
    setToken(null);
    await Promise.all([secureDelete(TOKEN_KEY), secureDelete(USER_KEY)]);
  }, [user]);

  const updateUser = useCallback(async (nextUser: User) => {
    setUser(nextUser);
    await secureSet(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const login = async (credentials: LoginRequest) => {
    trackEvent('auth_login_submitted');
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
      if (e.name === 'AbortError') {
        trackEvent('auth_login_failed', {
          error_type: 'timeout',
        });
        throw new Error('Connessione scaduta. Controlla la tua rete e riprova.');
      }
      trackEvent('auth_login_failed', {
        error_type: 'network',
      });
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorMessage = await extractErrorMessage(response, 'Login failed');
      trackEvent('auth_login_failed', {
        status_code: response.status,
        error_message: errorMessage,
      });
      throw new Error(errorMessage);
    }

    const data: AuthResponse = await safeJson(response, 'Login failed');

    setUser(data.user);
    setToken(data.token);
    await Promise.all([
      secureSet(TOKEN_KEY, data.token),
      secureSet(USER_KEY, JSON.stringify(data.user)),
    ]);
    trackEvent('auth_login_succeeded', {
      user_id: data.user.id,
    });
    registerPushToken(API_URL, data.token).catch((e) => {
      console.error('[PushToken] Failed to register push token:', e);
    });
  };

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!token || !user) {
        throw new Error('Devi effettuare il login per eliminare l’account.');
      }

      trackEvent('account_deletion_submitted', {
        user_id: user.id,
      });

      const response = await fetch(`${API_URL}/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errorMessage = await extractErrorMessage(
          response,
          'Impossibile eliminare l’account.',
        );
        trackEvent('account_deletion_failed', {
          user_id: user.id,
          status_code: response.status,
          error_message: errorMessage,
        });
        throw new Error(errorMessage);
      }

      trackEvent('account_deletion_succeeded', {
        user_id: user.id,
      });

      setUser(null);
      setToken(null);
      await Promise.all([secureDelete(TOKEN_KEY), secureDelete(USER_KEY)]);
    },
    [token, user],
  );

  const register = async (data: RegisterRequest) => {
    trackEvent('auth_register_submitted');
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorMessage = await extractErrorMessage(response, 'Registration failed');
      trackEvent('auth_register_failed', {
        status_code: response.status,
        error_message: errorMessage,
      });
      throw new Error(errorMessage);
    }

    const authData: AuthResponse = await safeJson(response, 'Registration failed');

    if (!authData.user.phone_verified) {
      trackEvent('auth_register_pending_phone_verification', {
        user_id: authData.user.id,
      });
      return;
    }

    setUser(authData.user);
    setToken(authData.token);
    await Promise.all([
      secureSet(TOKEN_KEY, authData.token),
      secureSet(USER_KEY, JSON.stringify(authData.user)),
    ]);
    trackEvent('auth_register_succeeded', {
      user_id: authData.user.id,
    });
    registerPushToken(API_URL, authData.token).catch((e) => {
      console.error('[PushToken] Failed to register push token:', e);
    });
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    deleteAccount,
    logout,
    updateUser,
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
