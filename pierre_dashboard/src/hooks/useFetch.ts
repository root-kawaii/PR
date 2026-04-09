import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';

export function useFetch<T>(path: string) {
  const { token, logout } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [path, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
