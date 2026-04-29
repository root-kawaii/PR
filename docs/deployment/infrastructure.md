# Deployment Infrastructure

## Environments

| | Staging | Production |
|---|---|---|
| **Backend** | `pierreclubs-backend-staging.fly.dev` | `pierreclubs-backend-prod.fly.dev` |
| **Dashboard** | Vercel Preview → `staging` branch | Vercel Production |
| **Mobile** | EAS OTA → channel `staging` | EAS build profile `production` |
| **Database** | Supabase project staging | Supabase project prod |
| **Stripe** | `sk_test_*` / `pk_test_*` | `sk_live_*` / `pk_live_*` |

---

## Backend (Fly.io)

Two separate Fly.io apps, one per environment. App name and `APP_ENV` are baked into the respective `fly.*.toml`; everything sensitive is a Fly.io secret.

### Fly.io config files

| File | App |
|---|---|
| `rust_BE/fly.staging.toml` | `pierreclubs-backend-staging` |
| `rust_BE/fly.production.toml` | `pierreclubs-backend-prod` |

Both files set `PORT`, `HOST`, and `APP_ENV` in `[env]` — no secrets in the toml.

### Fly.io secrets (per app)

Set via `fly secrets set --app <name> KEY=value`. Never committed to git.

| Secret | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Postgres connection string with pgbouncer |
| `JWT_SECRET` | ✅ | Min 32 chars |
| `APP_BASE_URL` | ✅ | Used for Stripe Checkout redirect URLs and payment share links |
| `OWNER_APP_BASE_URL` | — | Defaults to `APP_BASE_URL` if unset |
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_*` on staging, `sk_live_*` on production |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | `pk_test_*` on staging, `pk_live_*` on production |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Separate webhook endpoint per environment in Stripe dashboard |
| `SUPABASE_URL` | — | Required for panorama + event image uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required for panorama + event image uploads |
| `POSTHOG_API_KEY` | — | Analytics; omit to disable |
| `TWILIO_ACCOUNT_SID` | — | SMS OTP; omit to disable |
| `TWILIO_AUTH_TOKEN` | — | SMS OTP |
| `TWILIO_VERIFY_SERVICE_SID` | — | SMS OTP |
| `TWILIO_PHONE_NUMBER` | — | SMS OTP |

### Env vars with code defaults (no secret needed unless overriding)

| Var | Default in code |
|---|---|
| `POSTHOG_HOST` | `https://eu.i.posthog.com` |
| `SERVICE_NAME` | `rust_BE` |
| `SUPABASE_EVENT_IMAGES_BUCKET` | `event-images` |
| `SUPABASE_PANORAMAS_BUCKET` | `panoramas` |
| `MAX_PANORAMA_BYTES` | `52428800` (50 MB) |
| `PAYMENT_SHARE_TTL_HOURS` | `48` |
| `PUBLIC_CACHE_TTL_SECONDS` | `60` |
| `OUTBOX_POLL_INTERVAL_SECONDS` | `5` |
| `OUTBOX_BATCH_SIZE` | `50` |
| `PAYMENT_FREQUENT_INTERVAL_SECONDS` | `1800` |
| `IDEMPOTENCY_CLEANUP_INTERVAL_SECONDS` | `3600` |
| `AUTO_RUN_DB_MIGRATIONS` | `false` — migrations run via CI |

---

## Dashboard (Vercel — pierre-dashboard)

Vercel manages its own environment variables per deployment context. No dashboard-related variables belong in GitHub Actions.

| Var | Production | Preview (staging branch) | Preview (develop branch) |
|---|---|---|---|
| `VITE_API_URL` | prod backend URL | staging backend URL | staging backend URL |
| `VITE_APP_ENV` | `production` | `staging` | `develop` |
| `VITE_POSTHOG_KEY` | prod PostHog key | generic Preview key | generic Preview key |
| `VITE_POSTHOG_HOST` | `https://eu.i.posthog.com` | `https://eu.i.posthog.com` | — (inherits) |

---

## Mobile (Expo / EAS)

| | Staging | Production |
|---|---|---|
| **Deploy type** | OTA update (`eas update`) | Native build (`eas build`) |
| **EAS channel/branch** | `staging` | — |
| **EAS build profile** | — | `production` |
| **API URL** | `EXPO_PUBLIC_API_URL` = staging backend | `EXPO_PUBLIC_API_URL` = prod backend |

---

## CI/CD Workflows

### `.github/workflows/staging-backend.yml`

| Trigger | Behavior |
|---|---|
| Push to `main` | Runs migrations + deploys automatically |
| `workflow_dispatch` | Manual, each step toggleable |

Jobs: `migrations` → `deploy_backend` → `summary`
Uses GitHub Environment: **Staging**

### `.github/workflows/deploy.yml`

| Trigger | Behavior |
|---|---|
| Tag `v*` | Runs migrations + deploys automatically |
| `workflow_dispatch` | Manual, each step toggleable + optional EAS build |

Jobs: `migrations` → `deploy_backend` → `build_app` (optional) → `summary`
Uses GitHub Environment: **Production**

### `.github/workflows/staging-app.yml`

| Trigger | Behavior |
|---|---|
| `workflow_dispatch` | Pushes OTA update to EAS `staging` channel |

Uses GitHub Environment: **Staging**

---

## GitHub Actions — Secrets & Variables

### Repository secrets (shared across all workflows)

| Secret | Used by |
|---|---|
| `FLY_API_TOKEN` | All backend deploy workflows |
| `EXPO_TOKEN` | `staging-app.yml`, `deploy.yml` (build_app job) |

### Per-environment secrets

Both **Staging** and **Production** environments must have these set.
They are used only by the migration jobs to connect directly to the Supabase Postgres instance.

| Secret | Value |
|---|---|
| `PGHOST` | Supabase DB host (e.g. `db.<ref>.supabase.co`) |
| `PGUSER` | `postgres` |
| `PGPASSWORD` | Supabase DB password |
| `PGDATABASE` | `postgres` |
| `PGSSLMODE` | `require` |

### Per-environment variables (non-sensitive)

**Staging:**

| Variable | Value |
|---|---|
| `API_URL` | `https://pierreclubs-backend-staging.fly.dev` |
| `APP_ENV` | `staging` |
| `EAS_UPDATE_BRANCH` | `staging` |

**Production:**

| Variable | Value |
|---|---|
| `API_URL` | `https://pierreclubs-backend-prod.fly.dev` |
| `APP_ENV` | `production` |
| `EAS_BUILD_PROFILE` | `production` |
| `SUPPORT_URL` | `https://pierre.app/support` |
| `PRIVACY_URL` | `https://pierre.app/privacy` |
| `TERMS_URL` | `https://pierre.app/terms` |

---

## Adding a new environment

1. Create a new Fly.io app: `fly apps create pierreclubs-backend-<env>`
2. Copy `fly.staging.toml` → `fly.<env>.toml`, set `app` and `APP_ENV`
3. Set all Fly.io secrets: `fly secrets set --app pierreclubs-backend-<env> KEY=value ...`
4. Create a GitHub Environment named `<Env>` with PG secrets + `API_URL` variable
5. Add a new workflow or extend existing ones to target the new environment
6. Create a Supabase project and run all migrations from scratch:
   ```bash
   for f in DB/migrations/*.sql; do psql $NEW_DATABASE_URL -f "$f"; done
   ```
7. Create a Stripe webhook endpoint pointing to the new backend URL
