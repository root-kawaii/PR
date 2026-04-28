# 2026-04-25: Dashboard Known Issues — 5 Bug Fixes

**Branch**: `claude/fix-dashboard-issues`
**Status**: Done

---

## Overview

Five confirmed bugs in the club-owner dashboard, all fixed in one pass:

1. **DELETE event → 404** — PUT/DELETE routes were unregistered (routes existed in previous branch, verified present).
2. **PUT event → 404** — same as above.
3. **GET `/owner/events/:id/reservations` and POST `/owner/events/:id/reservations/manual` → 500** — all three SQL queries in `club_owner_persistence.rs` that deserialise into `TableReservation` were missing `payment_link_token` from their SELECT/RETURNING clause. sqlx's `FromRow` panics at runtime; the error was silently swallowed by `map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)`, so no log output appeared.
4. **Date filter on events was client-side** — moved to server-side via optional `?from_date=YYYY-MM-DD` query param on `GET /owner/events`.
5. **Phone not enforced in manual-reservation modal** — backend model requires it (`String`, not `Option<String>`), but the frontend input had no `required` attribute.

---

## Changes

### Backend (rust_BE)

#### `src/infrastructure/repositories/club_owner_persistence.rs`
Added `payment_link_token` to the SELECT/RETURNING clause of three functions:
- `get_event_reservations`
- `create_manual_reservation` RETURNING
- `update_reservation_status` RETURNING

#### `src/infrastructure/repositories/event_persistence.rs`
Added `from_date: Option<NaiveDate>` parameter to `get_events_by_club_id`. When present, adds `AND (event_date IS NULL OR event_date >= $2)`. Also changed ordering to `event_date ASC NULLS LAST, created_at DESC` in both branches.

#### `src/controllers/club_owner_controller.rs`
Added `EventFilterParams { from_date: Option<NaiveDate> }` struct and `Query<EventFilterParams>` extractor to `get_my_club_events`. Passes `params.from_date` to the persistence call.

### Dashboard (pierre_dashboard)

#### `src/pages/EventsPage.tsx`
- Moved `filterDate` state before the `useFetch` call.
- Changed fetch path to dynamic: `/owner/events?from_date=${filterDate}`.
- Removed `filteredEvents` useMemo (BE now filters); `filteredEvents` is now just `events ?? []`.
- Simplified count display and empty-state message.

#### `src/pages/EventReservationsPage.tsx`
- Added `required` to phone `<input>`.
- Updated label to `Telefono *`.

---

## Files Modified

| File | Change |
|------|--------|
| `rust_BE/src/infrastructure/repositories/club_owner_persistence.rs` | Add `payment_link_token` to 3 queries |
| `rust_BE/src/infrastructure/repositories/event_persistence.rs` | Add `from_date` param + WHERE clause |
| `rust_BE/src/controllers/club_owner_controller.rs` | `EventFilterParams` + `Query` extractor |
| `pierre_dashboard/src/pages/EventsPage.tsx` | Dynamic fetch path, remove client-side filter |
| `pierre_dashboard/src/pages/EventReservationsPage.tsx` | Phone `required` + label asterisk |
