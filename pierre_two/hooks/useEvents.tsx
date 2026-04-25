import { useState, useEffect, useRef } from "react";
import { Event } from "@/types";
import { API_URL } from "@/config/api";
import { apiFetch } from "@/config/apiFetch";
import { dedupeEvents } from "@/utils/events";

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

  const fetchPage = async (
    offset: number,
    signal: AbortSignal,
  ): Promise<{ events: Event[]; rawCount: number }> => {
    const res = await apiFetch(`${API_URL}/events?limit=${PAGE_SIZE}&offset=${offset}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawEvents = data.events || [];
    return {
      events: dedupeEvents(rawEvents),
      rawCount: rawEvents.length,
    };
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
      setEvents(page.events);
      setHasMore(page.rawCount === PAGE_SIZE);
      offsetRef.current = page.rawCount;
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
      setEvents((prev) => dedupeEvents([...prev, ...page.events]));
      setHasMore(page.rawCount === PAGE_SIZE);
      offsetRef.current += page.rawCount;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || "Failed to load more events");
    } finally {
      setLoadingMore(false);
    }
  };

  return { events, loading, loadingMore, error, hasMore, refetch: fetchEvents, loadMore };
};
