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
  - Each area card now shows a high-contrast **price pill** next to its
    name (`<area.price> / persona`) instead of a plain helper line. The
    per-table list dropped the "Min Spend" column entirely — the area
    pill is the single source of truth.

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

### Bug fix — duplicate tables in event tables endpoint

`GET /owner/events/:event_id/tables` was returning every club-level table
twice. The handler called both `get_tables_by_event_id` (which already
returns event-bound tables AND club-level tables whose area belongs to
the event's club) and `get_tables_by_club_id` (which returns the same
club-level set), then concatenated the two without deduping. Removed
the redundant second call. Surfaced as duplicates in the table picker
of the manual reservation modal during review.

### Two-tone gender slider

The slider in the manual reservation form is now coloured: the left
side (male) is blue, the right side (pink) is female. Implementation
uses a CSS variable `--gender-pct` set inline by the React component
and a `linear-gradient` on the `.gender-slider` track defined in
`pierre_dashboard/src/index.css`. M/F count labels are tinted to match
(blue / pink). Custom `::-webkit-slider-thumb` and `::-moz-range-thumb`
keep the thumb a clean white circle on both browsers.

### Mobile (`pierre_two`) — zone removal

`tables.zone` was a free-text label that predated `areas`. Every read
site in the app has been migrated to `areaName`:

- `app/(tabs)/tickets.tsx`: the small pill next to the table name now
  shows `areaName` instead of `zone`; styles renamed `zonePill` →
  `areaPill`, `zoneText` → `areaText`.
- `components/reservation/TableReservationDetailModal.tsx`: dropped the
  separate "Zona" row (it duplicated the area label already shown on
  "Tavolo"); fallback chains simplified to `areaName || name`.
- `components/reservation/TableReservationModal.tsx`: same fallback
  cleanup; the client-side `reservationForDetail.table` payload no
  longer carries `zone`.
- `components/event/TableFilterMenu.tsx`: `getAreaLabel` simplified to
  `areaName || 'A'`.
- `types/index.ts` and `constants/data.ts`: `zone` removed from the
  `Table` type and from the mock fixtures (mocks now use `areaName`).

### Database

`tables.zone` is **dropped** in migration
`DB/migrations/049_drop_tables_zone.sql`. Both the dashboard and the
mobile no longer read it, and the backend struct/SQL no longer reference
it.

`table_reservations.contact_phone` stays `NOT NULL`; the backend writes an
empty string when no phone is provided, since the dashboard already treats
empty phones as "absent" (`reservation.contactPhone && (...)`). This keeps
the SQLx model (`pub contact_phone: String`) and avoids cascading
`Option<String>` changes through the codebase. If we later need true
`NULL` semantics (e.g. for analytics filtering), a follow-up migration
can flip the column to nullable.

`tables.min_spend` is still on the schema as a denormalized cache of
`area.price`, read by reservation pricing in
`table_persistence::create_reservation` / `update_reservation`. Backend
keeps it in sync when the area price changes.

---

## Files Modified

| Layer | File |
|---|---|
| Dashboard | `pierre_dashboard/src/pages/EventReservationsPage.tsx` |
| Dashboard | `pierre_dashboard/src/pages/ClubAreasPage.tsx` |
| Dashboard | `pierre_dashboard/src/types/index.ts` |
| Backend | `rust_BE/src/models/table.rs` |
| Backend | `rust_BE/src/models/club_owner.rs` |
| Dashboard | `pierre_dashboard/src/index.css` |
| Backend | `rust_BE/src/controllers/area_controller.rs` |
| Backend | `rust_BE/src/controllers/table_controller.rs` |
| Backend | `rust_BE/src/controllers/club_owner_controller.rs` |
| Backend | `rust_BE/src/application/reservation_service.rs` |
| Backend | `rust_BE/src/infrastructure/repositories/area_persistence.rs` |
| Backend | `rust_BE/src/infrastructure/repositories/club_owner_persistence.rs` |
| Backend | `rust_BE/src/infrastructure/repositories/table_persistence.rs` |
| Mobile | `pierre_two/types/index.ts` |
| Mobile | `pierre_two/constants/data.ts` |
| Mobile | `pierre_two/app/(tabs)/tickets.tsx` |
| Mobile | `pierre_two/components/reservation/TableReservationDetailModal.tsx` |
| Mobile | `pierre_two/components/reservation/TableReservationModal.tsx` |
| Mobile | `pierre_two/components/event/TableFilterMenu.tsx` |
| Database | `DB/migrations/049_drop_tables_zone.sql` |
| Docs | `docs/daily-progress/2026-05-13-dashboard-areas-bookings.md` |
