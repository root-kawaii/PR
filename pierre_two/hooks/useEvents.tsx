import { useState, useEffect, useRef } from "react";
import { Event } from "@/types";
import { API_URL } from "@/config/api";
import { apiFetch } from "@/config/apiFetch";

const PAGE_SIZE = 20;

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchEvents();
    return () => abortRef.current?.abort();
  }, []);

  const fetchPage = async (offset: number, signal: AbortSignal): Promise<Event[]> => {
    const res = await apiFetch(`${API_URL}/events?limit=${PAGE_SIZE}&offset=${offset}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.events || [];
  };

  const fetchEvents = async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!silent) setLoading(true);
      setError(null);
      offsetRef.current = 0;

      const page = await fetchPage(0, controller.signal);
      setEvents(page);
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current = page.length;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || "Failed to fetch events");
      setEvents([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingMore(true);
    try {
      const page = await fetchPage(offsetRef.current, controller.signal);
      setEvents(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current += page.length;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || "Failed to load more events");
    } finally {
      setLoadingMore(false);
    }
  };

  return { events, loading, loadingMore, error, hasMore, refetch: fetchEvents, loadMore };
};
