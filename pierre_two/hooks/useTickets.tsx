import { useState, useEffect } from 'react';
import { Ticket } from '@/types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';

// Platform-aware API URL (same logic as AuthContext)
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

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTickets();
    } else {
      setTickets([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTickets = async (silent = false) => {
    if (!user) {
      setError('No user logged in');
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      const res = await fetch(`${API_URL}/tickets/user/${user.id}`);

      if (!res.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await res.json();
      setTickets(data.tickets || []);
      setError(null);
    } catch (e) {
      console.error('Failed to fetch tickets:', e);
      setError('Failed to fetch tickets');
      if (!silent) {
        setTickets([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  return { tickets, loading, error, refetch: fetchTickets };
};