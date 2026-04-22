# Production Environment Setup

This checklist is the concrete follow-up to the staging and production audit.

It defines the production variables and secrets that should exist across GitHub, Fly.io, Expo, and the dashboard hosting layer.

## GitHub environment

Use the GitHub environment named `Production`.

The production workflow now reads these environment-scoped variables:

| Variable | Example value | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | Sets the mobile build environment and aligns analytics tags |
| `API_URL` | `https://pierre-two-backend-prod.fly.dev` | Production backend URL used by build and deploy verification |
| `FLY_APP_NAME` | `pierre-two-backend-prod` | Fly app name used by the production deploy workflow |
| `EAS_BUILD_PROFILE` | `production` | EAS build profile for the production mobile build |
| `SUPPORT_URL` | `https://pierre.app/support` | Mobile app support link |
| `PRIVACY_URL` | `https://pierre.app/privacy` | Mobile app privacy policy link |
| `TERMS_URL` | `https://pierre.app/terms` | Mobile app terms link |

The production workflow expects these secrets in the `Production` environment, or as repo-level fallback secrets until migration is complete:

| Secret | Purpose |
| --- | --- |
| `FLY_API_TOKEN` | Deploy production backend to Fly.io |
| `PGHOST` | Production database host for migrations |
| `PGUSER` | Production database user |
| `PGPASSWORD` | Production database password |
| `PGDATABASE` | Production database name |
| `PGSSLMODE` | Database SSL mode |
| `EXPO_TOKEN` | Trigger EAS production builds |
| `NETLIFY_AUTH_TOKEN` | Optional production dashboard deployment |
| `NETLIFY_SITE_ID` | Optional production dashboard site |

## Fly.io production app

Production Fly app:

- `pierre-two-backend-prod`

Required Fly secrets for production:

- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `APP_ENV`

Strongly recommended production Fly secrets:

- `OWNER_APP_BASE_URL`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`
- `ALERT_WEBHOOK_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `TWILIO_PHONE_NUMBER`

Recommended production values:

- `APP_ENV=production`
- `SERVICE_NAME=rust_BE`
- `APP_BASE_URL=https://pierre-two-backend-prod.fly.dev` only if that domain is the correct public base URL for payment redirects

## Expo / EAS production config

The repo now marks the production EAS profile with:

- `APP_ENV=production`

Production builds should receive:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_STRIPE_KEY`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_SUPPORT_URL`
- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_TERMS_URL`

These can be supplied through EAS environment configuration, GitHub Actions environment variables, or both.

## Dashboard production config

Recommended production dashboard variables:

- `VITE_API_URL`
- `VITE_APP_ENV=production`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`

## Suggested GitHub commands

These commands set the non-sensitive production environment variables:

```bash
gh variable set APP_ENV --env Production --body production
gh variable set API_URL --env Production --body https://pierre-two-backend-prod.fly.dev
gh variable set FLY_APP_NAME --env Production --body pierre-two-backend-prod
gh variable set EAS_BUILD_PROFILE --env Production --body production
gh variable set SUPPORT_URL --env Production --body https://pierre.app/support
gh variable set PRIVACY_URL --env Production --body https://pierre.app/privacy
gh variable set TERMS_URL --env Production --body https://pierre.app/terms
```

Secrets still need to be set with real values and should not be committed to the repo.

## Verification

After configuration is complete:

1. Confirm the `Production` GitHub environment contains the expected variables and secrets.
2. Confirm Fly secrets include `APP_ENV=production`.
3. Confirm the Fly app `pierre-two-backend-prod` has all required runtime secrets, including the new production `DATABASE_URL`.
4. Run the production deploy workflow manually once.
5. Verify the backend health check uses the production URL.
6. Trigger one production EAS build and confirm it resolves the production API URL.
