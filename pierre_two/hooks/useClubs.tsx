import { useState, useEffect } from 'react';
import { Club } from '@/types';
import { API_URL } from '@/config/api';

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