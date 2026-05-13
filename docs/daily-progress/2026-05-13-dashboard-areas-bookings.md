# 2026-05-13: Dashboard polish — areas, reservations, manual booking

**Branch**: `claude/dashboard-areas-bookings-soqpJ`
**Issue**: #70
**Status**: Ready for review

---

## Overview

A pass over the club-owner dashboard tackling six small but high-friction
issues (#70):

1. **Min spend** is now managed at the area level only — removed from the
   per-table form. The area `price` is the single source of truth; a
   change to it propagates to every table inside that area.
2. **"Zona"** (a free-text label on tables) was unused and confusing
   because tables already live under areas. Removed from the dashboard
   forms.
3. **Reservations page** got an **area filter** in the toolbar.
4. **Reservations page** columns are now **sortable** (asc → desc → none).
5. The **manual reservation form** no longer requires a phone number.
6. The manual reservation form's M/F inputs are replaced with a **slider**
   under "Numero persone". Total is the source of truth; default split is
   50/50 with the extra unit going to M when odd.

DB columns `tables.min_spend` and `tables.zone` are kept in place as
denormalized data — mobile still reads them — so no destructive migration
in this PR. The slider write path keeps M + F == persone, eliminating the
incoherent-state bug.

---

## Changes

### Dashboard (`pierre_dashboard`)

- `src/pages/EventReservationsPage.tsx`:
  - Added **area filter** dropdown next to the status filter; options come
    from the tables loaded for the event.
  - Made each header column a clickable sort toggle (`asc → desc → off`)
    with arrow icons; sort keys: code, client, table, persone, M/F,
    importo, stato.
  - Replaced the two M/F number inputs (both in the create and the edit
    modals) with a `<GenderSlider>`: single range input under "Persone",
    male count on the left, female count on the right, both always
    visible. Total stays the source of truth; toggling persone resets the
    split to the 50/50 default (extra unit on M when odd).
  - Telefono is no longer `required` in the create form; the edit form
    drops `required` too. Empty value is sent as `undefined` so the
    backend stores empty string (see backend note below).
  - Memoized `reservations` and `tables` to keep the new `useMemo` chains
    stable.
- `src/pages/ClubAreasPage.tsx`:
  - Removed the **Min Spend** and **Zona** inputs from the table form. The
    table inherits its min spend from the area; a helper line under the
    capacity field makes this explicit.
  - In the per-area tables list, the "Min Spend" cell now shows the
    area's price (the single source of truth) and the "Zona" column is
    gone.

### Backend (`rust_BE`)

- `models/table.rs`: dropped `zone` and `min_spend` from
  `CreateClubTableRequest` and `UpdateTableRequest`. Documented the
  rationale in a doc comment.
- `controllers/area_controller.rs`:
  - `create_my_club_table` now always uses `area.price` for the new
    table's min spend (the `min_spend` request field no longer exists).
  - `update_my_club_table` no longer touches `zone` or `min_spend` —
    those are derived from the area.
- `controllers/table_controller.rs`: the legacy event-level
  `update_table` handler also stops forwarding `zone`/`min_spend` (the
  fields no longer exist on `UpdateTableRequest`).
- `infrastructure/repositories/area_persistence.rs`: when
  `update_area` changes the area `price`, it now syncs `tables.min_spend`
  and `tables.total_cost` for every table in that area in the same
  transaction. This keeps the per-area "single source of truth" semantics
  even though the denormalized column still lives on the table row.
- `models/club_owner.rs`: `CreateManualReservationRequest.contact_phone`
  is now `Option<String>`.
- `controllers/club_owner_controller.rs`: trims/normalizes the optional
  phone and stores an empty string when missing.

### Database

No destructive migration in this PR.

`table_reservations.contact_phone` stays `NOT NULL`; the backend writes an
empty string when no phone is provided, since the dashboard already treats
empty phones as "absent" (`reservation.contactPhone && (...)`). This keeps
the SQLx model (`pub contact_phone: String`) and avoids cascading
`Option<String>` changes through the codebase. If we later need true
`NULL` semantics (e.g. for analytics filtering), a follow-up migration
can flip the column to nullable.

`tables.min_spend` and `tables.zone` are still on the schema:

- `min_spend` continues to act as a denormalized cache of `area.price`,
  read by reservation pricing in `table_persistence::create_reservation`
  and `update_reservation`. Backend keeps it in sync.
- `zone` is still selected by `pierre_two` (table filtering, listings).
  Dropping it is out of scope for this PR but is a candidate for a
  follow-up that updates the mobile client first.

---

## Files Modified

| Layer | File |
|---|---|
| Dashboard | `pierre_dashboard/src/pages/EventReservationsPage.tsx` |
| Dashboard | `pierre_dashboard/src/pages/ClubAreasPage.tsx` |
| Backend | `rust_BE/src/models/table.rs` |
| Backend | `rust_BE/src/models/club_owner.rs` |
| Backend | `rust_BE/src/controllers/area_controller.rs` |
| Backend | `rust_BE/src/controllers/table_controller.rs` |
| Backend | `rust_BE/src/controllers/club_owner_controller.rs` |
| Backend | `rust_BE/src/infrastructure/repositories/area_persistence.rs` |
| Backend | `rust_BE/src/infrastructure/repositories/club_owner_persistence.rs` |
| Docs | `docs/daily-progress/2026-05-13-dashboard-areas-bookings.md` |
