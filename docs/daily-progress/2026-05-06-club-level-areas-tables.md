# 2026-05-06: Club-level areas & tables management

**Branch**: `claude/github-issue-47-843ym`
**Issue**: [#47](https://github.com/pierre-clubs/PR-root/issues/47)
**Status**: Done — `cargo check` ✅

---

## Overview

Tables and areas were previously configured per-event (under
`/dashboard/events/:id/tables`), forcing owners to recreate them for every
serata. Per issue #47 we move table management to the **club level**: areas and
tables are configured once for the club and reused by every event. Clicking an
event card now goes straight to its reservations page.

To keep existing data and reservations valid, `tables.event_id` is made
nullable instead of dropped: rows created before this change remain bound to
their event, while the new club-level UI creates rows with `event_id IS NULL`
that are reusable across events. Reservations keep their `table_id` and
`event_id` unchanged.

---

## Changes

### Database

- **`DB/migrations/044_club_level_tables.sql`** — drops `NOT NULL` on
  `tables.event_id`, replaces the `ensure_table_area_default()` trigger so it
  tolerates `event_id IS NULL` (only the area path is required), and adds a
  partial unique index on `(area_id, name) WHERE event_id IS NULL` to prevent
  duplicate table names within an area at the club level.

### Backend

- **`rust_BE/src/models/table.rs`** — `Table.event_id` becomes `Option<Uuid>`,
  `TableResponse.event_id` becomes `Option<String>`. New `CreateClubTableRequest`
  payload (`area_id` instead of `event_id`).
- **`rust_BE/src/infrastructure/repositories/table_persistence.rs`** —
  - `get_tables_by_club_id(pool, club_id)`: returns club-level tables joined
    via `area_id → club_id`.
  - `create_club_table(...)`: inserts a row with `event_id = NULL`.
  - `count_reservations_by_table(...)`: gates deletion when active
    (`pending`/`confirmed`) reservations exist.
- **`rust_BE/src/controllers/area_controller.rs`** — new owner endpoints:
  - `GET /owner/tables` → `list_my_club_tables`
  - `POST /owner/tables` → `create_my_club_table`
  - `PATCH /owner/tables/:id` → `update_my_club_table`
  - `DELETE /owner/tables/:id` → `delete_my_club_table` (returns `409` if the
    table has active reservations)
  - Helper `ensure_table_belongs_to_club` covers both event-bound and
    club-level tables when checking owner scope.
- **`rust_BE/src/controllers/club_owner_controller.rs`** —
  - New `verify_table_in_club` helper used by the table-image handlers to
    authorise both legacy event-bound and new club-level tables.
  - Reservation-update validation tolerates club-level target tables
    (`event_id IS NULL` ⇒ reusable across events).
- **`rust_BE/src/controllers/area_controller.rs`** — `assign_table_area`
  ownership check no longer assumes `table.event_id` is `Some`.
- **`rust_BE/src/api/routers/areas.rs`** — registers the four new routes.

### Dashboard

- **`pierre_dashboard/src/pages/ClubAreasPage.tsx`** *(new)* — single page
  reachable at `/dashboard/club/areas` that lists every area as a card with
  its tables inline. Owners can create / edit / delete areas (name, price,
  description) and tables (area, name, capacity, min spend, zone, location).
  Deletion confirms before calling the API and surfaces `409` errors as a
  friendly message.
- **`pierre_dashboard/src/App.tsx`** — adds `/dashboard/club/areas`, removes
  `/dashboard/events/:eventId/tables` and the `EventTablesPage` import.
- **`pierre_dashboard/src/pages/EventTablesPage.tsx`** *(deleted)*.
- **`pierre_dashboard/src/pages/EventsPage.tsx`** — event card click now links
  to `/dashboard/events/:id/reservations`.
- **`pierre_dashboard/src/pages/EventReservationsPage.tsx`** — back link points
  to the events list (the per-event tables page is gone).
- **`pierre_dashboard/src/pages/EventTourConfigPage.tsx`** — back link points
  to the event reservations page.
- **`pierre_dashboard/src/components/Sidebar.tsx`** — adds an "Aree e tavoli"
  nav entry between "Eventi" and "Scanner QR".
- **`pierre_dashboard/src/types/index.ts`** — `TableResponse.eventId` becomes
  optional to match the backend.

---

## Files Modified

| File | Change |
|---|---|
| `DB/migrations/044_club_level_tables.sql` | new migration |
| `rust_BE/src/models/table.rs` | `event_id` optional; new request type |
| `rust_BE/src/models/mod.rs` | export `CreateClubTableRequest` |
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | club-scoped queries |
| `rust_BE/src/controllers/area_controller.rs` | club-table CRUD handlers |
| `rust_BE/src/controllers/club_owner_controller.rs` | scope helpers |
| `rust_BE/src/api/routers/areas.rs` | new routes |
| `pierre_dashboard/src/pages/ClubAreasPage.tsx` | new page |
| `pierre_dashboard/src/pages/EventTablesPage.tsx` | deleted |
| `pierre_dashboard/src/App.tsx` | route changes |
| `pierre_dashboard/src/pages/EventsPage.tsx` | card link → reservations |
| `pierre_dashboard/src/pages/EventReservationsPage.tsx` | back-link target |
| `pierre_dashboard/src/pages/EventTourConfigPage.tsx` | back-link target |
| `pierre_dashboard/src/components/Sidebar.tsx` | nav entry |
| `pierre_dashboard/src/types/index.ts` | `eventId` optional |
