import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Event } from '@/types';

// Platform-aware API URL (same logic as useGenres/useClubs)
const getApiUrl = () => {
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
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      setEvents(data.events || []);
      setError(null);
    } catch (e) {
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