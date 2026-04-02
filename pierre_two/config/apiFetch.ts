import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch wrapper that adds a 10-second timeout.
 * Accepts an optional `options.signal` for external cancellation (e.g. AbortController on unmount).
 * - External signal aborted  → re-throws AbortError so callers can ignore it silently.
 * - Timeout fires first       → throws a user-facing Error so callers can show an error state.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const externalSignal = options.signal as AbortSignal | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      timeoutController.abort();
    } else {
      externalSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(url, { ...options, signal: timeoutController.signal });
    return response;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw e; // Caller aborted (unmount / new request) — re-throw so caller can ignore silently
      }
      throw new Error('La richiesta è scaduta. Controlla la tua connessione.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Hook that returns an authenticated fetch wrapper.
 * Injects Bearer token, handles 401 → auto-logout.
 */
export function useApiFetch() {
  const { token, logout } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await apiFetch(url, { ...options, headers });

      if (response.status === 401) {
        await logout();
        throw new Error('Sessione scaduta. Effettua nuovamente il login.');
      }

      return response;
    },
    [token, logout],
  );
}
