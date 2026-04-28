# 2026-04-28: Staging Backend CI Workflow + Infra Docs

**Branch**: `feature/update-workflow`
**Status**: Done

---

## Overview

Added a dedicated GitHub Actions workflow for staging backend deploys (migrations + Fly.io deploy), documented the full deployment infrastructure, set `APP_ENV` in the Fly.io toml files, and removed an ad-hoc one-off migration script that no longer belongs in the repo.

---

## Changes

### CI/CD

#### `.github/workflows/staging-backend.yml` (new)
- Triggers on push to `main` and via `workflow_dispatch` (with toggleable `run_migrations` / `deploy_backend` inputs).
- Three jobs: `migrations` → `deploy_backend` → `summary`.
- `migrations`: connects to Supabase via `psql`, ensures `schema_migrations` table exists, runs only pending files in `DB/migrations/` and records each one.
- `deploy_backend`: `flyctl deploy --config fly.staging.toml --remote-only --ha=false`, then a `/health` smoke check.
- Uses GitHub Environment **Staging** (PG secrets + `API_URL` variable).
- Concurrency groups prevent overlapping runs per job type.

### Backend (rust_BE)

#### `rust_BE/fly.staging.toml`
Added `APP_ENV = "staging"` to `[env]`.

#### `rust_BE/fly.production.toml`
Added `APP_ENV = "production"` to `[env]`.

### Documentation

#### `docs/deployment/infrastructure.md` (new)
Single source of truth for the deploy setup: per-environment Fly.io apps, Vercel dashboard config, EAS mobile channels/profiles, full secrets/variables matrix for GitHub Actions, and a checklist for adding a new environment.

### Cleanup

#### `run_migration.js` (deleted)
One-off Node script (with a hardcoded Supabase connection string) used to seed `marzipano_config` on existing events. Migrations now run via CI; the script no longer belongs in the repo.

---

## Files Modified

| File | Change |
|------|--------|
| `.github/workflows/staging-backend.yml` | New workflow: migrations + Fly.io staging deploy |
| `docs/deployment/infrastructure.md` | New: full deploy infrastructure reference |
| `rust_BE/fly.staging.toml` | Add `APP_ENV = "staging"` |
| `rust_BE/fly.production.toml` | Add `APP_ENV = "production"` |
| `run_migration.js` | Deleted (one-off seed script) |
