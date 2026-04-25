---
name: pierre-release-ops
description: Audit, deploy, document, and troubleshoot Pierre staging and production release operations. Use when working on Pierre environment separation, Fly.io backend deploys, Supabase database migrations, EAS/Expo builds and TestFlight submissions, Vercel dashboard deploys, GitHub Actions release secrets, Stripe/PostHog environment variables, or when recovering the current staging/prod topology from prior setup work.
---

# Pierre Release Ops

## Operating Rules

Use this skill as the Pierre release runbook. Prefer concrete status checks before changing anything, and never print or commit secret values. Store only secret names, destinations, and verification results.

Read `references/current-state.md` when you need exact app IDs, URLs, command recipes, or known gotchas from the April 2026 staging/prod rebuild.

## First Checks

Start from repo root `/Users/monolith/Documents/PR`.

Run a quick status map before acting:

```bash
git status --short
flyctl status --app pierreclubs-backend-prod
flyctl status --app pierreclubs-backend-staging
cd pierre_two && npx eas-cli whoami
cd pierre_two && npx eas-cli env:list --environment production
cd pierre_two && npx eas-cli env:list --environment preview
```

Use `rg` for repo discovery. Important files:

```text
rust_BE/fly.production.toml
rust_BE/fly.staging.toml
rust_BE/fly.toml
rust_BE/Dockerfile
rust_BE/Cargo.toml
rust_BE/Cargo.lock
pierre_two/app.config.js
pierre_two/eas.json
.github/workflows/deploy.yml
.github/workflows/deploy-dashboard.yml
pierre_dashboard/src/config/api.ts
pierre_dashboard/.vercel/project.json
```

## Backend Deploys

Use remote Fly deploys first:

```bash
cd /Users/monolith/Documents/PR/rust_BE
flyctl deploy --config fly.production.toml --remote-only --ha=false
flyctl deploy --config fly.staging.toml --remote-only --ha=false
```

If Fly remote builders time out or dependency fetches hang, use the local Docker fallback described in `references/current-state.md`. Do not assume Docker is required every time; it was a workaround for builder flakiness.

Health check after every deploy:

```bash
curl -fsS https://pierreclubs-backend-prod.fly.dev/health
curl -fsS https://pierreclubs-backend-staging.fly.dev/health
```

## Secrets

Manage secrets in each target system, not in committed files.

Fly backend secret names:

```text
APP_BASE_URL
APP_ENV
DATABASE_URL
JWT_SECRET
SERVICE_NAME
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
OWNER_APP_BASE_URL
POSTHOG_API_KEY
POSTHOG_HOST
```

EAS public/mobile env names:

```text
APP_ENV
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_EAS_PROJECT_ID
EXPO_PUBLIC_STRIPE_KEY
EXPO_PUBLIC_POSTHOG_KEY
EXPO_PUBLIC_POSTHOG_HOST
```

Use `production` for prod EAS and `preview` for staging EAS. If the same key exists both in `eas.json` profile env and hosted EAS env, EAS profile env wins.

## EAS And TestFlight

Use `npx eas-cli`, not `npx eas`, in this repo.

Staging app:

```bash
cd /Users/monolith/Documents/PR/pierre_two
APP_ENV=staging npx eas-cli build --platform ios --profile staging --auto-submit-with-profile staging --non-interactive --no-wait
APP_ENV=staging npx eas-cli submit --platform ios --latest --profile staging --non-interactive
```

Production app:

```bash
cd /Users/monolith/Documents/PR/pierre_two
APP_ENV=production npx eas-cli build --platform ios --profile production --auto-submit-with-profile production --non-interactive --no-wait
APP_ENV=production npx eas-cli submit --platform ios --latest --profile production --non-interactive
```

Always set `APP_ENV=staging` for staging submit commands. Without it, EAS can resolve credentials for the prod bundle while targeting the staging ASC app, which produces confusing generic Apple submission failures.

If Apple rejects a duplicate bundle version, bump the remote iOS version:

```bash
cd /Users/monolith/Documents/PR/pierre_two
APP_ENV=staging npx eas-cli build:version:set --platform ios --profile staging
```

## Databases And Migrations

Supabase prod and staging are separate projects. Use pooler URLs for IPv4/network compatibility. Do not store database passwords in this skill.

Before migrations, confirm which database is targeted by `DATABASE_URL`. Run migrations for both prod and staging only when explicitly intended.

## Dashboard Deploys

Use the command docs when deploying the Vercel dashboard:

```text
.codex/commands/deploy-dashboard-staging.md
.codex/commands/deploy-dashboard-production.md
```

Current good practice is one Vercel project with separate environments:

```text
Production -> https://pierreclubs-backend-prod.fly.dev
Preview/staging branch -> https://pierreclubs-backend-staging.fly.dev
```

Manual CLI prebuilt deploys from `pierre_dashboard/` are known to work. Automatic Git deploys require the Vercel project root directory to be `pierre_dashboard`; if root directory is `.`, Vercel may run `vite build` at repo root and fail with `vite: command not found`.

## Documentation Updates

When release topology changes, update:

```text
.codex/skills/pierre-release-ops/references/current-state.md
.codex/skills/release-environments/SKILL.md, if broader workflow guidance changes
repo env examples and docs, without secret values
```

Keep this skill factual, concise, and current. Remove stale app IDs or URLs quickly; stale release runbooks are sneaky little traps.
