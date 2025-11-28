import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types';

// Platform-aware API URL with environment variable support
const getApiUrl = () => {
  // Use production URL from app.json extra config if available
  const apiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (apiUrl) {
    return apiUrl;
  }

  // Fall back to local development
  const isDevice = Constants.isDevice;
  const isSimulator = Constants.deviceName?.includes('Simulator') ||
                      Constants.deviceName?.includes('Emulator');

  // If explicitly a simulator/emulator, use localhost equivalents
  if (isSimulator === true) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000'; // Android emulator
    }
    return 'http://127.0.0.1:3000'; // iOS simulator
  }

  // If explicitly a device OR if we can't determine (safer to assume device)
  if (isDevice === true || (isDevice !== false && !isSimulator)) {
    // Physical device - use your computer's local network IP
    return 'http://172.20.10.5:3000';
  }

  // Default fallback for simulators
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000'; // Android emulator
  }
  return 'http://127.0.0.1:3000'; // iOS simulator and web
};

const API_URL = getApiUrl();
const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';

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

  // Load saved auth data on mount
  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      const [savedToken, savedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Failed to load auth data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      console.log('=== DEBUG INFO ===');
      console.log('Attempting login with URL:', `${API_URL}/auth/login`);
      console.log('Platform:', Platform.OS);
      console.log('Is Physical Device:', Constants.isDevice);
      console.log('Device Name:', Constants.deviceName);
      console.log('==================');
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Login failed');
      }

      const data: AuthResponse = await response.json();

      // Save to state and async storage
      setUser(data.user);
      setToken(data.token);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Registration failed');
      }

      const authData: AuthResponse = await response.json();

      // Save to state and async storage
      setUser(authData.user);
      setToken(authData.token);
      await AsyncStorage.setItem(TOKEN_KEY, authData.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(authData.user));
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear state
      setUser(null);
      setToken(null);

      // Clear async storage
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch (error) {
      console.error('Logout error:', error);
    }
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