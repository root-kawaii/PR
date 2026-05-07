# 2026-05-07: CLAUDE.md backend index refresh

**Branch**: `claude/graphify-token-savings-qkDtM`
**Status**: Ready for review

---

## Overview

Refreshed the Backend section of `CLAUDE.md` so the documented layout matches
the current `rust_BE/src/` tree, and added a small "where to look" lookup
table for the most common cross-file questions. Goal: cut the number of
exploratory `grep`/`Read` calls future sessions need before they can edit
backend code, as a low-cost alternative to installing a full knowledge-graph
tool (Graphify) for the same purpose.

---

## Context

The user asked whether installing Graphify (a build-time knowledge graph that
plugs into Claude Code via a `PreToolUse` hook) would save tokens. Before
adopting an external indexer with refresh/maintenance overhead, we agreed to
try the cheaper baseline first: keep `CLAUDE.md` honest and add a small
manual lookup index.

While preparing the index, several entries in `CLAUDE.md` turned out to be
stale relative to the current codebase:

- Layer order described as `models → persistences → controllers`, but
  `rust_BE/src/persistences/` no longer exists; queries live in
  `rust_BE/src/infrastructure/repositories/<entity>_persistence.rs`.
- Routes described as registered in `main.rs`, but they are now split into
  `rust_BE/src/api/routers/<entity>.rs` and composed in
  `api/routers/mod.rs`.
- The `application/<entity>_service.rs` layer (orchestration / business
  logic) was not mentioned at all.
- `bootstrap/` (config, AppState, migrations) and `jobs/` (Tokio background
  workers: GC, idempotency cleanup, outbox dispatcher, payment maintenance)
  were missing from the directory listing.
- `ApiError` was documented as `crate::models::ApiError`, but it now lives
  at `crate::api::errors::ApiError` (see `rust_BE/src/api/errors.rs:9`).
- The migration-numbering note didn't mention that `029`, `030`, and `042`
  each have two files from concurrent branches, which makes the
  `ls | sort | tail -1` recipe ambiguous.

---

## Changes

### Documentation

- **`CLAUDE.md`** — Backend section rewritten:
  - Corrected layer order to
    `api/routers → controllers → application → infrastructure/repositories → models`,
    with a note that not every entity has a service layer yet.
  - Replaced the directory listing with the current tree (`bootstrap/`,
    `api/routers/`, `api/errors.rs`, `application/`,
    `infrastructure/repositories/`, `infrastructure/outbox|analytics|logging/`,
    `jobs/`, `services/`, `middleware/`, `idempotency/`, `utils/`).
  - Updated `ApiError` import path in the example snippet.
  - Rewrote the "Adding a route" recipe to walk through routers →
    controller → service → repository → model.
  - Added a "Where to look (saves a grep)" table mapping recurring questions
    (Stripe webhook handler, reservation+payment atomic creation,
    split-payment guest pages, GC reference sets, mobile data hooks,
    dashboard pages) to specific files.
- **`CLAUDE.md`** — Database section: appended a one-line warning that
  numbers `029`, `030`, `042` are duplicated and the next migration must
  use the next free number above the highest, not blindly `+1` from the
  duplicated one.

### Backend / Mobile / Dashboard / Database

No code changes.

---

## Files Modified

| File | Change |
|---|---|
| `CLAUDE.md` | Backend section refreshed; lookup table added; migration-duplicates note added |
| `docs/daily-progress/2026-05-07-claudemd-backend-index.md` | New (this file) |

---

## Follow-ups

- Re-evaluate Graphify after a few sessions: if exploratory grep volume is
  still high despite the manual index, the marginal cost of a build-time
  knowledge graph + refresh hook may be justified.
- The Mobile and Dashboard sections of `CLAUDE.md` were not audited in this
  pass; spot-check on the next mobile/dashboard task.
