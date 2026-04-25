# Pierre — Mobile App

React Native / Expo Router app for the Pierre nightclub platform. Users discover events, buy tickets, reserve VIP tables, and manage their bookings.

## Tech

- **Expo SDK 54** / Expo Router 6 (file-based navigation)
- **React Native 0.81**, TypeScript
- **Stripe React Native** for payments
- **Marzipano / Kuula / CloudPano** 360° venue tours (WebView)
- `react-native-qrcode-svg` for ticket QR codes
- `expo-secure-store` for JWT storage (falls back to in-memory on Expo Go)
- `expo-notifications` for push tokens (requires dev build)

## Setup

```bash
npm install
npx expo start
```

Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) for full functionality (SecureStore, push notifications, Stripe). Expo Go works for basic UI development.

For local app plus local backend development:

```bash
# iOS simulator / web
npm run start:local-ios

# Android emulator
npm run start:local-android
```

Those scripts keep the app pointed at your local backend on port `3000`. Staging EAS builds still use the remote staging backend configured in `eas.json`.

Optional frontend analytics env vars:

- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST` (defaults to `https://eu.i.posthog.com`)
- `APP_ENV`

## Screens

| Route | Description |
|-------|-------------|
| `app/login.tsx` | Login |
| `app/register.tsx` | 2-step registration (account → phone verify) |
| `app/(tabs)/index.tsx` | Home — event discovery |
| `app/(tabs)/tickets.tsx` | My Bookings — tickets + table reservations |
| `app/(tabs)/profile.tsx` | Profile + theme picker |
| `app/pay/[token].tsx` | Guest payment link (no auth required) |

## Auth

JWT stored in SecureStore. `AuthContext` exposes `user`, `token`, `login`, `register`, `logout`. Token expiry is decoded locally from the JWT `exp` claim and checked on app launch.

## Theming

Five themes in `constants/theme.ts`. Default: **Champagne Noir** (gold `#C9A84C` on near-black). Switch to **Midnight Rose** (rose/violet) or others from the Profile tab. Theme persists via AsyncStorage.

## Backend

Local development should target your local backend first. By default this repo expects the backend to run on port `3000`, while the backend itself can be configured to use the shared staging database via `rust_BE/.env`.
