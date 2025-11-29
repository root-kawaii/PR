import { useState, useEffect } from 'react';
import { Ticket } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/api';

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