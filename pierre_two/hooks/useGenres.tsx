import { useState, useEffect } from 'react';
import { Genre } from '@/types';
import { API_URL } from '@/config/api';

export const useGenres = () => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const res = await fetch(`${API_URL}/genres`);

      if (!res.ok) {
        throw new Error('Failed to fetch genres');
      }

      const data = await res.json();
      setGenres(data || []);
      setError(null);
    } catch (e) {
      console.error('Failed to fetch genres:', e);
      setError('Failed to fetch genres');
      if (!silent) {
        setGenres([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  return { genres, loading, error, refetch: fetchGenres };
};