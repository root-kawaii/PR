# Staging And Production Environments

Snapshot date: April 22, 2026

This document captures the verified current state of Pierre's staging and production setup, the main gaps, and a practical path to a clean two-environment deployment model.

## Verified sources

- Checked-in repo config in `.github/workflows/`, `rust_BE/`, `pierre_two/`, `pierre_dashboard/`, and `.codex/`
- Local git state from this workspace
- Live GitHub state via `gh`
- Live Fly.io state via `flyctl`
- Live Expo/EAS verification attempt via `npx eas-cli@latest`

## Current state snapshot

### Repo topology

| Area | Current state |
| --- | --- |
| Backend | `rust_BE/` deployed to Fly.io |
| Mobile app | `pierre_two/` uses Expo / EAS |
| Dashboard | `pierre_dashboard/` uses Vite; no checked-in deployment workflow in the current tree |
| Database | Remote Postgres / Supabase-style setup managed through SQL migrations in `DB/migrations/` |

### Branch state in this workspace

- Local `main` is behind `origin/main` by 1 commit.
- Local `staging` is ahead of `origin/staging` by 1 commit.
- Remote branches of interest exist for `main`, `staging`, and `develop`.

### GitHub Actions: live status

Verified on April 22, 2026:

- Active workflows:
  - `Deploy Backend & Build App`
  - `Staging App Deploy (OTA)`
- Recent successful staging OTA runs:
  - April 21, 2026 at `2026-04-21T20:30:33Z`
  - April 20, 2026 at `2026-04-20T18:57:22Z`
  - April 17, 2026 at `2026-04-17T20:20:04Z`
- Recent successful manual deploy workflow run:
  - April 9, 2026 at `2026-04-09T22:21:07Z`
  - Triggered from branch `17-gestionale-qr-code`, not from `main`
- Recent failed tagged deploy workflow run:
  - April 2, 2026 at `2026-04-02T21:46:52Z`
  - Triggered by tag `v9`

### GitHub Actions: structure and secrets

Current checked-in workflows:

- `.github/workflows/deploy.yml`
  - push on tags matching `v*`
  - manual `workflow_dispatch`
  - explicitly targets GitHub environment `Production`
  - runs production migrations, backend deploy, and optional EAS production build
- `.github/workflows/staging-app.yml`
  - push on branch `staging`
  - explicitly targets GitHub environment `Staging`
  - sends an OTA update to Expo branch `staging`

Verified live GitHub repository configuration on April 22, 2026:

- GitHub environments exist:
  - `Production`
  - `Preview`
  - `Staging`
- All current GitHub environments currently have:
  - no protection rules
  - no environment-scoped secrets visible
- Current environment-scoped GitHub Actions variables in `Production`:
  - `API_URL=https://pierreclubs-backend-prod.fly.dev`
  - `APP_ENV=production`
  - `EAS_BUILD_PROFILE=production`
  - `FLY_APP_NAME=pierreclubs-backend-prod`
  - `PRIVACY_URL=https://pierre.app/privacy`
  - `SUPPORT_URL=https://pierre.app/support`
  - `TERMS_URL=https://pierre.app/terms`
- Current environment-scoped GitHub Actions variables in `Staging`:
  - `API_URL=https://pierreclubs-backend-staging.fly.dev`
  - `APP_ENV=staging`
  - `EAS_UPDATE_BRANCH=staging`
  - `FLY_APP_NAME=pierreclubs-backend-staging`
- Current repo-scoped GitHub Actions secrets:
  - `EXPO_TOKEN`
  - `FLY_API_TOKEN`
  - `VERCEL_TOKEN`
  - `PGDATABASE`
  - `PGHOST`
  - `PGPASSWORD`
  - `PGSSLMODE`
  - `PGUSER`
  - `STAGING_API_URL`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_HOST`
- Current repo-scoped GitHub Actions variables:
  - none visible from `gh variable list`

### Fly.io: live status

Verified on April 22, 2026:

- Fly apps under the account:
  - `pierre-two-backend`
  - `pierre-two-backend-prod`
  - `pierreclubs-backend-prod`
  - `pierreclubs-backend-staging`
  - `mariacho-backend`
  - `fly-builder-hidden-bush-872`
- New production-dedicated Fly apps now exist:
  - `pierre-two-backend-prod` under the older personal account
  - `pierreclubs-backend-prod` under the new company-owned account
- New staging-dedicated Fly app now exists:
  - `pierreclubs-backend-staging` under the new company-owned account
- There is still no separate Fly staging app for Pierre visible today.
- `pierre-two-backend` status:
  - hostname: `pierre-two-backend.fly.dev`
  - 2 machines in region `fra`
  - both machines were `stopped` at inspection time
  - latest machine updates:
    - `2026-04-22T16:00:40Z`
    - `2026-04-21T22:46:50Z`
- `pierreclubs-backend-prod` status at creation time:
  - hostname: `pierreclubs-backend-prod.fly.dev`
  - app exists
  - no image deployed yet
- `pierreclubs-backend-staging` status at creation time:
  - hostname: `pierreclubs-backend-staging.fly.dev`
  - app exists
  - no image deployed yet

Current Fly secret names for `pierre-two-backend`:

- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`

### Expo / EAS: checked-in config

From `pierre_two/eas.json` and `pierre_two/app.config.js`:

- EAS build profiles exist for:
  - `development`
  - `staging`
  - `preview`
  - `production`
- Expo channels in config:
  - `staging`
  - `preview`
  - `production`
- The app already differentiates bundle and package identifiers for staging:
  - iOS staging bundle id: `PR.staging`
  - Android staging package: `com.rootkawaii.pierre_two.staging`
- The app name changes for staging:
  - `Pierre (Staging)`

### Expo / EAS: live verification status

On April 22, 2026, `npx eas-cli@latest whoami` returned `Not logged in`.

That means the following could not be verified live from this machine:

- EAS branches
- EAS channels
- EAS environment variables
- recent EAS builds

## Important findings

### 1. Staging exists for the mobile app, but not for the backend

The staging OTA workflow is real and active, but the backend infrastructure is still single-environment:

- old app: `pierre-two-backend`
- company-owned production app shell: `pierreclubs-backend-prod`
- company-owned staging app shell: `pierreclubs-backend-staging`
- current production workflow hostname: `https://pierreclubs-backend-prod.fly.dev`
- current staging workflow hostname: `https://pierreclubs-backend-staging.fly.dev`

Result: both production and staging now have company-owned Fly app targets, but neither is fully deployable yet until the remaining runtime secrets are supplied and migrations are run.

### 2. Checked-in Expo profiles still point staging and production to the same backend URL

In `pierre_two/eas.json`:

- `staging` uses `EXPO_PUBLIC_API_URL=https://pierre-two-backend.fly.dev`
- `production` uses `EXPO_PUBLIC_API_URL=https://pierre-two-backend.fly.dev`

The staging OTA workflow improves this by injecting `secrets.STAGING_API_URL`, but the checked-in default still encodes production backend usage.

### 3. Production deploy control is too loose

The main deploy workflow can be run manually and recent successful runs were triggered from branch `17-gestionale-qr-code`.

That means production-capable deployment logic is not currently limited to a protected production branch or a protected GitHub environment.

### 4. GitHub environment separation is now partially wired, but not yet enforced end-to-end

`Production`, `Preview`, and `Staging` now exist in GitHub, and the current workflows reference `Production` and `Staging`.

That is a good step forward, but the setup is still incomplete because:

- there are no protection rules
- there are no environment-scoped secrets
- `Preview` is still hanging around as an older naming path
- repo-scoped secrets are still doing most of the real work

So separation is better than before, but still not fully enforced.

### 5. Environment naming is inconsistent across systems

Current names in use:

- git branch: `staging`
- GitHub environment: `Preview`
- Expo channel and profile: `staging`, `preview`, `production`
- backend app: only production-like `pierre-two-backend`

This makes releases harder to reason about and easy to misroute.

### 6. Production analytics environment is probably mislabeled today

`rust_BE/src/bootstrap/config.rs` sets analytics environment from `APP_ENV` or `RUST_ENV`, otherwise defaults to `development`.

Current Fly config and inspected Fly secrets did not show:

- `APP_ENV`
- `RUST_ENV`

That means the production backend is likely reporting analytics and log environment as `development`.

### 7. Some deployment docs and helper scripts are stale

Outdated items found in the repo:

- `scripts/switch-endpoint.js` tries to edit `pierre_two/app.json`, but the app now uses `pierre_two/app.config.js`
- `docs/10-ci-cd-setup.md` still describes older endpoint-switch behavior and older secret expectations
- previous `.codex/commands/` files were hardcoded to an old workspace path

### 9. GitHub Actions needs runtime maintenance soon

Latest run annotations show Node.js 20 deprecation warnings for GitHub Actions. Those actions need to be reviewed before GitHub fully removes Node 20 support.

## Recommended target model

### Naming

Use only two primary environment names everywhere:

- `staging`
- `production`

Avoid mixing `preview` into the main release path unless it is intentionally a third environment.

### Branch policy

Recommended:

- `main` -> production
- `staging` -> staging
- feature branches -> PR into `staging`
- promotion to production -> PR from `staging` into `main`

### GitHub Actions

Create or refactor toward:

- `ci.yml`
  - PR validation only
  - backend compile and test
  - dashboard build
  - mobile lint and type checks
- `deploy-staging.yml`
  - trigger on push to `staging`
  - use GitHub environment `Staging`
  - deploy staging backend
  - push Expo staging OTA
  - optionally deploy staging dashboard
- `deploy-production.yml`
  - trigger on push to `main` or version tags created from `main`
  - use GitHub environment `Production`
  - require environment approval
  - run production migrations
  - deploy production backend
  - build or submit production app
  - deploy production dashboard

Also add:

- `concurrency` groups so only one deploy per environment runs at a time
- path or service filters if you want faster iteration

Status after this repo change:

- `environment:` blocks are now wired into the checked-in staging and production workflows
- `concurrency` is now configured for those workflows
- protection rules and environment-scoped secrets still need to be added in GitHub

### Backend / Fly.io

Recommended target:

- production app:
  - keep `pierre-two-backend` or rename consistently
- staging app:
  - create `pierre-two-backend-staging`

Each app should have its own:

- Fly secrets
- hostname
- `APP_ENV`
- `APP_BASE_URL`
- `OWNER_APP_BASE_URL`
- Stripe webhook secret
- analytics configuration

### Database

Best practice:

- production database separate from staging database

Minimum acceptable fallback:

- if a second database cannot be created immediately, do not call the environment true staging
- instead call it `preview` and document that it shares production data

For fast iteration with low blast radius, separate databases are strongly preferred.

### Expo / EAS

Recommended target:

- `staging` EAS profile -> staging API URL
- `production` EAS profile -> production API URL
- `staging` channel -> staging branch
- `production` channel -> production branch

If `preview` remains, define it intentionally. Do not let it drift as an accidental alias for production.

### Dashboard

Choose one deploy target and make it explicit.

Because the target is now Vercel, the most consistent short path is:

- staging dashboard site
- production dashboard site
- separate `VITE_API_URL` and `VITE_APP_ENV` per site

## Required configuration matrix

These names should exist separately for staging and production where applicable.

### GitHub environment secrets

For `Staging`:

- `FLY_API_TOKEN`
- `PGHOST`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `PGSSLMODE`
- `STAGING_API_URL`
- `EXPO_TOKEN`
- dashboard hosting secrets if staging dashboard deploy is enabled

For `Production`:

- `FLY_API_TOKEN`
- `PGHOST`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `PGSSLMODE`
- `PRODUCTION_API_URL`
- `EXPO_TOKEN`
- dashboard hosting secrets if production dashboard deploy is enabled

### Fly secrets per backend app

Required in both environments:

- `DATABASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `APP_ENV`

Strongly recommended in both environments when relevant:

- `OWNER_APP_BASE_URL`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`
- `ALERT_WEBHOOK_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `TWILIO_PHONE_NUMBER`

## Implementation plan

### Phase 0: align naming and guardrails

1. Decide whether `Preview` in GitHub should become `Staging`.
2. Add GitHub environment protection rules.
3. Restrict production deploys to `main` or tags created from `main`.
4. Update docs so `staging` and `production` mean the same thing everywhere.

### Phase 1: create true backend separation

1. Create a staging Fly app.
2. Create a staging database or Supabase project.
3. Set staging Fly secrets, including `APP_ENV=staging`.
4. Set production `APP_ENV=production`.
5. Add a dedicated `fly.staging.toml` or a reusable deploy strategy that selects app by environment.

### Phase 2: split deployment workflows cleanly

1. Replace the mixed deploy workflow with environment-specific deploy workflows.
2. Move GitHub secrets from repo scope to environment scope where practical.
3. Add `concurrency` and environment approvals.
4. Update staging workflow to deploy backend plus OTA update together.

### Phase 3: finish app and dashboard alignment

1. Make `pierre_two/eas.json` default staging profile point to staging backend.
2. Verify live EAS branches, channels, and env variables once Expo auth is available.
3. Add a checked-in dashboard deploy workflow or document the external dashboard deploy path.
4. Add staging and production dashboard API URLs.

### Phase 4: clean up obsolete helpers

1. Replace or remove `scripts/switch-endpoint.js`.
2. Refresh `docs/DEPLOYMENT.md` and `docs/10-ci-cd-setup.md`.
3. Keep `.codex/commands/` aligned with the real repo paths and deploy flow.

## Immediate next actions

If the goal is fast iteration without breaking production, the highest-value next sequence is:

1. Create the staging backend app and staging database.
2. Add `APP_ENV` and environment-specific secrets to Fly.
3. Wire GitHub `Staging` and `Production` environments into workflows with approvals.
4. Point Expo staging to the staging backend by default.
5. Reintroduce or formalize dashboard deploys with separate staging and production URLs.

## Repo automation helpers

Codex helpers added for this workflow:

- `.codex/skills/release-environments/SKILL.md`
- `.codex/commands/repo-env-audit.md`
- `.codex/commands/github-actions-status.md`
- `.codex/commands/fly-status.md`
- `.codex/commands/eas-status.md`
- `.codex/commands/setup-production-env.md`

Existing command docs were also updated to remove stale hardcoded workspace paths.
