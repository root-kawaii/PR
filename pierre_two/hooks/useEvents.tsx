import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Event } from '@/types';

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

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      console.log('🔍 Fetching events from:', `${API_URL}/events`);
      const res = await fetch(`${API_URL}/events`);
      console.log('📡 Response status:', res.status);
      const data = await res.json();
      console.log('📦 Events received:', data.events?.length || 0);
      setEvents(data.events || []);
      setError(null);
    } catch (e) {
      console.error('❌ Error fetching events:', e);
      setError('Failed to fetch events');
      setEvents([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  return { events, loading, error, refetch: fetchEvents };
};