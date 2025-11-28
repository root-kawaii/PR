import { useState, useEffect } from 'react';
import { Club } from '@/types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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

  if (isSimulator === true) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    return 'http://127.0.0.1:3000';
  }

  if (isDevice === true || (isDevice !== false && !isSimulator)) {
    return 'http://172.20.10.5:3000';
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://127.0.0.1:3000';
};

const API_URL = getApiUrl();

export const useClubs = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const res = await fetch(`${API_URL}/clubs`);

      if (!res.ok) {
        throw new Error('Failed to fetch clubs');
      }

      const data = await res.json();
      setClubs(data || []);
      setError(null);
    } catch (e) {
      console.error('Failed to fetch clubs:', e);
      setError('Failed to fetch clubs');
      if (!silent) {
        setClubs([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  return { clubs, loading, error, refetch: fetchClubs };
};