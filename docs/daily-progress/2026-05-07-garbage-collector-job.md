# 2026-05-07: Garbage Collector Background Job

**Branch**: `claude/fix-pr-root-issue-44-Pkakb`
**Issue**: [#44](https://github.com/pierre-clubs/PR-root/issues/44)
**Status**: Ready for review

---

## Overview

Added a daily background job that detects and removes orphan rows from the
DB and orphan objects from Supabase Storage. The job follows the existing
`jobs/<name>.rs` + `record_job_run()` pattern (same shape as
`idempotency_cleanup` and `outbox_dispatcher`), is gated by `GC_ENABLED`,
defaults to `GC_DRY_RUN=true`, and isolates each cleaner so a failure in one
does not stop the others.

---

## Context

The DB and storage buckets accumulate orphans because some FK relationships
aren't strict enough:

- `events.club_id` is `FK -> clubs.id ON DELETE SET NULL`, so deleting a
  club leaves orphan events with `club_id IS NULL` (issue #43).
- `payments` has no FK to anything — only linked indirectly via
  `reservation_payment_shares.payment_id`.
- Storage objects in `event-images` (and the `panoramas` bucket when
  configured) are never deleted when the referencing row goes away or when
  an upload is abandoned mid-flow.

Other entity FKs (`tickets / tables / table_reservations /
reservation_payment_shares / reservation_guests / table_images`) already
cascade in current migrations, so cleaners for those are shipped as
**safety nets** that should normally find zero rows.

The user-confirmed scope decisions:

- **Panoramas bucket**: cleaner is gated by `SUPABASE_PANORAMAS_BUCKET`.
  When unset, the panoramas cleaner is reported as `skipped` in the round
  details.
- **Idempotency keys**: existing `jobs/idempotency_cleanup.rs` (hourly)
  stays untouched; not subsumed by the GC.
- **Tests**: logic-only unit tests for the storage helpers; DB-backed
  per-cleaner tests are deferred to a follow-up PR. Validation comes from
  staging dry-run.

---

## Changes

### Backend

#### New module `services/garbage_collector/`
- `mod.rs` — `CleanerStats { detected, deleted }` and `CleanerCtx
  { dry_run, min_orphan_age_hours }` plus per-cleaner sub-modules.
- `events_orphans.rs` — deletes events with `club_id IS NULL`.
- `payments_orphans.rs` — deletes payments not referenced by any
  `reservation_payment_shares.payment_id`.
- `tickets_orphans.rs`, `tables_orphans.rs`, `reservations_orphans.rs`,
  `reservation_shares_orphans.rs`, `reservation_guests_orphans.rs`,
  `table_images_orphans.rs` — safety-net cleaners for tables that already
  have `ON DELETE CASCADE`. Each deletes rows whose parent row no longer
  exists.
- `storage.rs` — `run_event_images` and `run_panoramas`. Builds the set of
  referenced storage paths from the DB (`events.image`, `table_images.url`,
  `events.marzipano_config[].imageUrl`), lists the bucket recursively via
  Supabase Storage REST API, marks unreferenced objects older than
  `min_orphan_age_hours` as orphans, and batch-deletes them in chunks of 100.
  Pure helpers (`reference_path_from_url`, `extract_panorama_urls`,
  `diff_orphans`, `chunk_for_delete`) covered by 9 unit tests.

Every DB cleaner runs the count + delete inside a single `BEGIN…COMMIT`
transaction, with `ROLLBACK` in dry-run mode so the row count is observed
without persisting the delete.

#### New job `jobs/garbage_collector.rs`
Orchestrator with `pub async fn run(state: Arc<AppState>)` — sleeps for
`GC_FIRST_RUN_DELAY_SECONDS` then loops on `tokio::time::interval` of
`GC_INTERVAL_SECONDS`. Each round invokes every cleaner, captures per-cleaner
errors, aggregates totals, logs `"GC round completed"` with structured
fields, and writes one row to `background_job_runs` with status
`success | partial_failure | failure` and a `cleaners` JSON map.

#### Wiring
- `services/mod.rs` — `pub mod garbage_collector;`.
- `jobs/mod.rs` — `pub mod garbage_collector;` and conditional spawn gated
  on `app_state.config.gc.enabled`. Logs "Garbage collector disabled
  (GC_ENABLED=false)" when off.
- `bootstrap/config.rs` — new `GcConfig` struct on `AppConfig` with env
  vars: `GC_ENABLED` (default `false`), `GC_DRY_RUN` (default `true`),
  `GC_INTERVAL_SECONDS` (default `86400`), `GC_MIN_ORPHAN_AGE_HOURS`
  (default `24`), `GC_FIRST_RUN_DELAY_SECONDS` (default `300`),
  `SUPABASE_PANORAMAS_BUCKET` (optional).

### Database

No schema changes. `background_job_runs` already exists and is the audit
sink, used the same way as the other jobs.

---

## Files Modified

| File | Change |
|---|---|
| `rust_BE/src/services/garbage_collector/mod.rs` | NEW: shared types + sub-module declarations |
| `rust_BE/src/services/garbage_collector/events_orphans.rs` | NEW: real orphan cleaner (`club_id IS NULL`) |
| `rust_BE/src/services/garbage_collector/payments_orphans.rs` | NEW: real orphan cleaner (no share refs) |
| `rust_BE/src/services/garbage_collector/tickets_orphans.rs` | NEW: safety-net cleaner |
| `rust_BE/src/services/garbage_collector/tables_orphans.rs` | NEW: safety-net cleaner |
| `rust_BE/src/services/garbage_collector/reservations_orphans.rs` | NEW: safety-net cleaner |
| `rust_BE/src/services/garbage_collector/reservation_shares_orphans.rs` | NEW: safety-net cleaner |
| `rust_BE/src/services/garbage_collector/reservation_guests_orphans.rs` | NEW: safety-net cleaner |
| `rust_BE/src/services/garbage_collector/table_images_orphans.rs` | NEW: safety-net cleaner |
| `rust_BE/src/services/garbage_collector/storage.rs` | NEW: bucket cleaners + 9 unit tests |
| `rust_BE/src/jobs/garbage_collector.rs` | NEW: round orchestrator + record_job_run |
| `rust_BE/src/services/mod.rs` | Register `garbage_collector` module |
| `rust_BE/src/jobs/mod.rs` | Register module + conditional spawn |
| `rust_BE/src/bootstrap/config.rs` | Add `GcConfig` and parse env vars |

---

## Verification

- `cargo check` — clean (only pre-existing warnings).
- `cargo clippy --bin rust_BE` — no new findings on GC code.
- `cargo test --bin rust_BE garbage_collector` — 9/9 tests pass.

Recommended staging procedure:

1. Deploy with `GC_ENABLED=true GC_DRY_RUN=true`.
2. Wait one tick (default 24 h, or set `GC_INTERVAL_SECONDS=10`
   `GC_FIRST_RUN_DELAY_SECONDS=0` for a quick smoke).
3. Inspect `SELECT details FROM background_job_runs WHERE
   job_name='garbage_collector' ORDER BY created_at DESC LIMIT 5;` and
   compare per-cleaner `detected` counts against a manual SQL audit.
4. Flip `GC_DRY_RUN=false` and confirm `deleted == detected` from the prior
   dry-run.

---

## Follow-up (out of scope)

- Add formal `ON DELETE CASCADE` FKs on `events.club_id` (currently `SET
  NULL`) once the product implications are decided. The GC would then act
  purely as a safety net.
- DB-backed `sqlx::test` infrastructure with a per-cleaner test that seeds
  an orphan and asserts it's detected/deleted. Deferred per scoping
  decision; logic tests cover the storage helpers today.
- Decide whether `jobs/idempotency_cleanup.rs` should be folded into the GC
  to consolidate background scheduling.
