import { useState, useEffect } from 'react';
import { Event } from '@/types';
import { getMockEvents } from '@/constants/data';

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3000/events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      setError('Failed to fetch events');
      setEvents(getMockEvents());
    } finally {
      setLoading(false);
    }
  };

  return { events, loading, error, refetch: fetchEvents };
};