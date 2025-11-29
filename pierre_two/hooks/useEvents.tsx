import { useState, useEffect } from 'react';
import { Event } from '@/types';
import { API_URL } from '@/config/api';

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