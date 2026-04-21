const DEFAULT_DEV_API_URL = 'http://localhost:3000';
const DEFAULT_PROD_API_URL = 'https://pierre-two-backend.fly.dev';

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const fallbackApiUrl = import.meta.env.PROD
  ? DEFAULT_PROD_API_URL
  : DEFAULT_DEV_API_URL;

export const API_URL = trimTrailingSlash(configuredApiUrl || fallbackApiUrl);
