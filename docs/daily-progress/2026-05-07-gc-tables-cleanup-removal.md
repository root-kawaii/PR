# 2026-05-07 — Remove tables_orphans GC cleaner

## Overview

Migration `044_club_level_tables.sql` made `tables.event_id` nullable so
tables can be configured at the club/area level and reused across events.
The `tables_orphans` GC cleaner predicate
`WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = t.event_id)` was
written before that change: with a NULL `event_id` the subquery never
matches, so `NOT EXISTS` is always true and the cleaner deleted every
club-level table on each round.

Tables are now parented on `area_id` (NOT NULL, FK `ON DELETE RESTRICT`),
which means they can no longer be orphaned by parent deletion. The
safety-net role of the cleaner no longer applies, so the cleaner is
removed entirely rather than rewritten.

## Changes

### Backend
- Deleted `services/garbage_collector/tables_orphans.rs`.
- Removed the module declaration from
  `services/garbage_collector/mod.rs`.
- Removed the `record_db("tables_orphans", …)` call from
  `jobs/garbage_collector.rs::run_round` and dropped the now-unused
  import.

### Docs
- Removed the `tables_orphans` row from the safety-net cleaners table in
  `docs/GARBAGE_COLLECTOR.md`.

## Files Modified

| File | Change |
|---|---|
| `rust_BE/src/services/garbage_collector/tables_orphans.rs` | Deleted |
| `rust_BE/src/services/garbage_collector/mod.rs` | Removed `pub mod tables_orphans` |
| `rust_BE/src/jobs/garbage_collector.rs` | Removed import + `record_db` call |
| `docs/GARBAGE_COLLECTOR.md` | Removed cleaner row |
