import type { Club, ClubOwner } from '../types';

type AnalyticsValue = unknown;
type AnalyticsProperties = Record<string, AnalyticsValue>;

const POSTHOG_API_KEY = (import.meta.env.VITE_POSTHOG_KEY ?? '').trim();
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com')
  .trim()
  .replace(/\/+$/, '');
const ANALYTICS_ENVIRONMENT = (import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE).trim();
const ANALYTICS_SERVICE_NAME = 'pierre_dashboard';
const ANALYTICS_SOURCE = 'frontend';
const ANALYTICS_PLATFORM = 'web';

const DISTINCT_ID_KEY = 'pierre_dashboard.analytics.distinct_id';
const OWNER_ID_KEY = 'pierre_dashboard.analytics.owner_id';

const baseProperties: AnalyticsProperties = {
  source: ANALYTICS_SOURCE,
  service_name: ANALYTICS_SERVICE_NAME,
  environment: ANALYTICS_ENVIRONMENT,
  platform: ANALYTICS_PLATFORM,
};

export const analyticsEnabled = Boolean(POSTHOG_API_KEY);

let sessionId = createId('session');
let identifiedProperties: AnalyticsProperties = {};
let currentDistinctId = getOrCreateDistinctId();

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getStoredValue(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore localStorage failures so analytics never blocks the UI.
  }
}

function getOrCreateDistinctId() {
  const stored = getStoredValue(DISTINCT_ID_KEY);
  if (stored) {
    return stored;
  }

  const freshId = createId('anon');
  setStoredValue(DISTINCT_ID_KEY, freshId);
  return freshId;
}

function sanitizeProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
}

function captureEvent(eventName: string, distinctId: string, properties: AnalyticsProperties = {}) {
  if (!analyticsEnabled) {
    return;
  }

  void fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: true,
    body: JSON.stringify({
      api_key: POSTHOG_API_KEY,
      event: eventName,
      distinct_id: distinctId,
      properties: sanitizeProperties({
        distinct_id: distinctId,
        session_id: sessionId,
        ...baseProperties,
        ...identifiedProperties,
        ...properties,
      }),
    }),
  }).catch(() => {
    // Analytics failures should stay silent.
  });
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  captureEvent(eventName, currentDistinctId, properties);
}

export function trackScreen(screenName: string, properties: AnalyticsProperties = {}) {
  trackEvent('screen_viewed', {
    screen_name: screenName,
    ...properties,
  });
}

export function identifyAnalyticsOwner(owner: ClubOwner, club: Club | null) {
  const previousDistinctId = currentDistinctId;
  currentDistinctId = owner.id;
  setStoredValue(DISTINCT_ID_KEY, currentDistinctId);
  setStoredValue(OWNER_ID_KEY, owner.id);

  identifiedProperties = {
    authenticated: true,
    owner_id: owner.id,
    club_id: club?.id ?? null,
    role: 'club_owner',
  };

  captureEvent('$identify', owner.id, {
    $anon_distinct_id: previousDistinctId !== owner.id ? previousDistinctId : undefined,
    $set: {
      email: owner.email,
      name: owner.name,
      phone_number: owner.phone_number ?? null,
      club_id: club?.id ?? null,
      club_name: club?.name ?? null,
      role: 'club_owner',
      environment: ANALYTICS_ENVIRONMENT,
      service_name: ANALYTICS_SERVICE_NAME,
    },
  });
}

export function resetAnalytics() {
  identifiedProperties = {};
  sessionId = createId('session');
  currentDistinctId = createId('anon');
  setStoredValue(DISTINCT_ID_KEY, currentDistinctId);
  setStoredValue(OWNER_ID_KEY, null);
}
