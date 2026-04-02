import { useState, useEffect, useRef } from 'react';
import { Ticket } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/api';
import { apiFetch } from '@/config/apiFetch';

const PAGE_SIZE = 20;

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { user } = useAuth();
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (user) {
      fetchTickets();
    } else {
      setTickets([]);
      setLoading(false);
    }
    return () => abortRef.current?.abort();
  }, [user]);

  const fetchPage = async (offset: number, signal: AbortSignal): Promise<Ticket[]> => {
    const res = await apiFetch(
      `${API_URL}/tickets/user/${user!.id}?limit=${PAGE_SIZE}&offset=${offset}`,
      { signal },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.tickets || [];
  };

  const fetchTickets = async (silent = false) => {
    if (!user) {
      setError('No user logged in');
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!silent) setLoading(true);
      setError(null);
      offsetRef.current = 0;

      const page = await fetchPage(0, controller.signal);
      setTickets(page);
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current = page.length;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Failed to fetch tickets');
      if (!silent) setTickets([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!user || loadingMore || !hasMore) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingMore(true);
    try {
      const page = await fetchPage(offsetRef.current, controller.signal);
      setTickets(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current += page.length;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Failed to load more tickets');
    } finally {
      setLoadingMore(false);
    }
  };

  return { tickets, loading, loadingMore, error, hasMore, refetch: fetchTickets, loadMore };
};
