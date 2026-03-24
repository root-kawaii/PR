# 2026-03-25: Gestionale — Event CRUD & Owner Stats

**Branch**: `17-gestionale-qr-code`
**Status**: In Progress

---

## Overview

Completed the event management section of the club owner dashboard: owners can now create, edit, and delete their events directly from the web UI. Added a `GET /owner/stats` endpoint for the dashboard home. Cleaned up the database by dropping the deprecated `matterport_id` column.

---

## Changes

### Backend (rust_BE)

#### New routes in `main.rs`

| Method | Route | Handler |
|--------|-------|---------|
| `PUT` | `/owner/events/:event_id` | `update_club_event` |
| `DELETE` | `/owner/events/:event_id` | `delete_club_event` |
| `GET` | `/owner/stats` | `get_owner_stats_handler` |

#### `models/event.rs`

- Added `UpdateEventRequest` struct (all fields optional, used for partial updates via `COALESCE` in SQL).
- `EventResponse` now serializes fields in camelCase (`ageLimit`, `endTime`, `tourProvider`, `tourId`, `marzipanoScenes`).
- `From<Event> for EventResponse` derives `time` from the ISO date string when the `time` column is empty/null.
- Empty strings are treated as null for `status`, `age_limit`, and `end_time` — allows clearing these fields via the dashboard.

#### `persistences/event_persistence.rs`

Added three new functions:
- `update_event(pool, event_id, UpdateEventRequest)` — partial update using `COALESCE`.
- `delete_event(pool, event_id)` — returns `bool` indicating if a row was deleted.
- `get_events_by_club_id(pool, club_id)` — fetches all events for a given club, ordered by `created_at DESC`.

Updated all existing SELECT queries to include the full column list (was missing `tour_provider`, `tour_id`, `marzipano_config`).

#### `controllers/club_owner_controller.rs`

- `update_club_event`: verifies ownership, prevents changing `club_id`, calls `event_persistence::update_event`.
- `delete_club_event`: verifies ownership, calls `event_persistence::delete_event`.
- `get_owner_stats_handler`: looks up the owner's club, delegates to `club_owner_persistence::get_owner_stats`.

#### `persistences/club_owner_persistence.rs`

Added `get_owner_stats(pool, club_id) -> OwnerStats` — aggregates active reservation count, total revenue, and per-event table stats.

### Database

#### `DB/migrations/030_cleanup_events_table.sql`

Drops the deprecated `matterport_id` column from `events`. This field was superseded by `tour_provider` + `tour_id` + `marzipano_config` in earlier sessions.

```sql
ALTER TABLE events DROP COLUMN IF EXISTS matterport_id;
```

### Dashboard (pierre_dashboard)

#### `src/types/index.ts`

Added `EventResponse` interface (mirrors the backend `EventResponse` camelCase fields):

```typescript
export interface EventResponse {
  id: string;
  title: string;
  venue: string;
  date: string;
  image: string;
  status?: string;
  time?: string;
  ageLimit?: string;
  endTime?: string;
  price?: string;
  description?: string;
  tourProvider?: string;
  tourId?: string;
  marzipanoScenes?: unknown;
}
```

Also added `OwnerStats` and `EventStatRow` interfaces (consumed by `DashboardPage`).

#### `src/pages/EventsPage.tsx`

Complete overhaul of the events page:

- **Date filter**: defaults to today; hides past events; shows `N of M events` counter.
- **Create modal**: form with title, venue, date+time, end time, age limit, status (select: HOT / SOLD OUT / CANCELLED), price, image URL, description.
- **Edit modal**: pre-populates from the event — re-uses the same form component.
- **Delete**: confirmation dialog before `DELETE /owner/events/:id`; refetches list on success.
- **Event cards**: display image, title, venue, date+time range, and pill badges for status/ageLimit/price. Each card links to the tables page; edit/delete buttons sit below in a card footer.
- Date parsing handles ISO (`2026-03-25T23:00:00`), `YYYY-MM-DD`, and legacy Italian format (`25 MAR | 23:00`).

### Mobile (pierre_two)

#### `app.json`

- Version bumped `1.0.x → 1.1.0`.
- Added `edgeToEdgeEnabled: true` and `predictiveBackGestureEnabled: false` for Android.
- `apiUrl` updated to current local network IP.

#### `src/main.rs` — DELETED

Removed a stray Rust file that had been placed inside the React Native project folder by mistake.

---

## Files Modified

| File | Change |
|------|--------|
| `rust_BE/src/models/event.rs` | Added `UpdateEventRequest`; enriched `EventResponse` camelCase + time derivation |
| `rust_BE/src/persistences/event_persistence.rs` | Added `update_event`, `delete_event`, `get_events_by_club_id` |
| `rust_BE/src/controllers/club_owner_controller.rs` | Added `update_club_event`, `delete_club_event`, `get_owner_stats_handler` |
| `rust_BE/src/main.rs` | Registered new owner routes |
| `rust_BE/src/persistences/club_owner_persistence.rs` | Added `get_owner_stats` |
| `DB/migrations/030_cleanup_events_table.sql` | NEW — drops `matterport_id` |
| `pierre_dashboard/src/types/index.ts` | Added `EventResponse`, `OwnerStats`, `EventStatRow` |
| `pierre_dashboard/src/pages/EventsPage.tsx` | Full CRUD UI with date filter and modal |
| `pierre_two/app.json` | Version bump, Android flags |
| `pierre_two/src/main.rs` | DELETED (stray file) |

---

## Owner API — Current Endpoints

```
GET    /owner/club                               → get club info
PUT    /owner/club                               → update club settings
GET    /owner/club/images                        → list club images
POST   /owner/club/images                        → add club image
DELETE /owner/club/images/:id                    → delete club image
GET    /owner/events                             → list events for this club
POST   /owner/events                             → create event
PUT    /owner/events/:id                         → update event          ← NEW
DELETE /owner/events/:id                         → delete event          ← NEW
GET    /owner/events/:id/tables                  → list tables for event
POST   /owner/events/:id/tables                  → create table
GET    /owner/events/:id/reservations            → list reservations
POST   /owner/events/:id/reservations/manual     → create manual reservation
PATCH  /owner/reservations/:id/status            → update reservation status
GET    /owner/tables/:id/images                  → list table images
POST   /owner/tables/:id/images                  → add table image
DELETE /owner/table-images/:id                   → delete table image
GET    /owner/scan/:code                         → scan QR (read-only)
POST   /owner/checkin/:code                      → check in by QR
GET    /owner/stats                              → aggregated stats       ← NEW
```

---

## Related

- [piano-gestionale.md](../piano-gestionale.md) — original feature spec
- [2026-01-13-enhanced-marzipano-hotspots.md](./2026-01-13-enhanced-marzipano-hotspots.md) — previous session
