# 2026-04-29: DB Migration Workflow Hardening

**Branch**: `feature/update-workflow`
**Status**: Done

---

## Overview

Hardened both staging and production DB migration workflows after the first staging run revealed two failure modes that masked real problems: silently swallowed connection errors and per-statement SQL errors that didn't fail the migration. Also resolved the underlying connection issue (Supabase pooler IPv4 vs direct IPv6 host).

---

## Context

The first staging run hit `psql: connection ... Network is unreachable` because GitHub Actions runners are IPv4-only and the direct Supabase host (`db.<ref>.supabase.co:5432`) only resolves to IPv6 on the free plan. After switching `PGHOST`/`PGUSER` secrets to the Supavisor pooler (`aws-0-eu-west-1.pooler.supabase.com`, user `postgres.<ref>`) the connection worked, but the run still applied all 53 migrations because:

1. The `schema_migrations` SELECT was wrapped in `2>/dev/null || echo ""`, so a transient auth failure produced an empty applied-list and the workflow assumed everything was pending.
2. `psql -f migration.sql` returns exit code 0 even when individual statements inside the file fail, so visible `ERROR: ... already exists` lines were ignored and the migrations were marked complete anyway.

---

## Changes

### CI/CD

#### `.github/workflows/staging-backend.yml`
- Removed temporary "Debug connection params" step that was used to diagnose the pooler auth failure.
- Moved `CREATE TABLE IF NOT EXISTS schema_migrations` from the run step into the check step, before the `SELECT` — so the SELECT can no longer fail for "table missing", only for real connection/SQL issues.
- Removed `2>/dev/null || echo ""` wrappers from `ls` and the `SELECT migration_name` query — connection/SQL errors now surface in the logs instead of being silently dropped.
- Added `-v ON_ERROR_STOP=1` to every `psql` invocation (CREATE, SELECT, `-f migration.sql`, INSERT into `schema_migrations`). Any failing statement inside a migration file now aborts that file and fails the job.

#### `.github/workflows/deploy.yml`
- Same hardening applied to the production workflow (it shared the same fragile logic). No debug step to remove there.

---

## Files Modified

| File | Change |
|---|---|
| `.github/workflows/staging-backend.yml` | Removed debug step, hardened check + run steps |
| `.github/workflows/deploy.yml` | Hardened check + run steps |

---

## Follow-up (out of scope)

- Plan a migration to **Supabase CLI native migrations** (`supabase db push`). The current homemade system has duplicate prefixes (`011_*` x2, `012_*` x2, …) and a missing `023` that would need to be resolved as part of that move. Estimated ~1 day of work; tracked separately.
- The `/new-migration` and `/run-migration` slash commands referenced in `CLAUDE.md` aren't actually defined in `.claude/commands/`; either implement them or remove from the docs.
