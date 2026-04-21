import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { PostHogEventProperties } from '@posthog/core';
import PostHog from 'posthog-react-native';

import type { User } from '../types';

type AnalyticsProperties = PostHogEventProperties;

const analyticsExtra = Constants.expoConfig?.extra ?? {};

export const POSTHOG_API_KEY =
  typeof analyticsExtra.posthogApiKey === 'string' ? analyticsExtra.posthogApiKey : '';
export const POSTHOG_HOST =
  typeof analyticsExtra.posthogHost === 'string' ? analyticsExtra.posthogHost : 'https://eu.i.posthog.com';
export const ANALYTICS_ENVIRONMENT =
  typeof analyticsExtra.appEnv === 'string'
    ? analyticsExtra.appEnv
    : (__DEV__ ? 'development' : 'production');
export const ANALYTICS_SERVICE_NAME = 'pierre_two';
export const ANALYTICS_SOURCE = 'frontend';
export const ANALYTICS_APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

const baseSuperProperties: AnalyticsProperties = {
  source: ANALYTICS_SOURCE,
  service_name: ANALYTICS_SERVICE_NAME,
  environment: ANALYTICS_ENVIRONMENT,
  app_version: ANALYTICS_APP_VERSION,
  platform: Platform.OS,
};

export const analyticsEnabled = Boolean(POSTHOG_API_KEY);

export const posthogClient = analyticsEnabled
  ? new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
    })
  : null;

posthogClient?.register(baseSuperProperties);

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  posthogClient?.capture(eventName, properties);
}

export function trackScreen(screenName: string, properties: AnalyticsProperties = {}) {
  posthogClient?.screen(screenName, properties);
}

export function identifyAnalyticsUser(user: User) {
  if (!posthogClient) {
    return;
  }

  posthogClient.register({
    ...baseSuperProperties,
    authenticated: true,
    user_id: user.id,
  });

  posthogClient.identify(user.id, {
    $set: {
      email: user.email,
      name: user.name,
      phone_number: user.phone_number ?? null,
      platform: Platform.OS,
      app_version: ANALYTICS_APP_VERSION,
    },
    $set_once: {
      first_seen_app_version: ANALYTICS_APP_VERSION,
    },
  });
}

export function resetAnalytics() {
  if (!posthogClient) {
    return;
  }

  posthogClient.reset();
  posthogClient.register(baseSuperProperties);
}

export function buildScreenName(segments: string[]) {
  const cleanedSegments = segments.filter((segment) => segment && !segment.startsWith('('));

  return cleanedSegments.length ? `/${cleanedSegments.join('/')}` : '/';
}
