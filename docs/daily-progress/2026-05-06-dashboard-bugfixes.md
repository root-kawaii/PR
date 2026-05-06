# 2026-05-06: Dashboard bugfixes & club info refresh

**Branch**: `develop`
**Status**: Done — `cargo check` ✅, `tsc --noEmit` ✅

---

## Overview

A round of UX/data-flow bugfixes on the club-owner dashboard, plus two
underlying issues that were silently breaking persistence:

1. **Sidebar** — "Impostazioni Locale" stayed highlighted while on
   `/dashboard/club/areas` because its `NavLink` matched by prefix.
2. **EventsPage filter** — date filter sat in its own `SectionCard`,
   stacked above "Nuovo evento", and was lost on reload.
3. **EventsPage** — no quick way to jump to per-event 360° tour config.
4. **EventReservationsPage** — header didn't show which event the
   reservations belonged to.
5. **Manual reservation modal** — no tables selectable after the
   club-level areas/tables migration: the per-event endpoint filters
   `WHERE t.event_id = $1`, but new tables have `event_id IS NULL`.
6. **Tour 360 navigation** — promoted the club-level configurator from a
   button buried in Impostazioni Locale to its own sidebar entry.
7. **Stale localStorage** — `AuthProvider` only wrote to localStorage on
   login; updating the club from the settings page left the cached copy
   (and therefore the sidebar) out of date.
8. **Club image** — there was no UI to change the club image, and
   `OwnerUpdateClubRequest` hardcoded `image: None`.
9. **Club address/phone/website not surfacing** — `ClubResponse` was
   missing those fields entirely, so the form reloaded empty even though
   the DB had them. Felt like "the address isn't being saved".
10. **Galleria immagini** — hidden temporarily to deprioritize gallery
    work in favor of the 360° tour configuration.

---

## Changes

### Backend

- **`rust_BE/src/models/club.rs`** — `ClubResponse` now exposes
  `address`, `phone_number`, `website` (all `Option<String>`,
  `skip_serializing_if = "Option::is_none"`); `From<Club>` maps them
  through. Fixes the symptom where saved info appeared lost on reload.
- **`rust_BE/src/models/club_owner.rs`** — `OwnerUpdateClubRequest`
  gains an optional `image` field so the dashboard can update the club
  image via PUT `/owner/club`.
- **`rust_BE/src/controllers/club_owner_controller.rs`** —
  - `update_my_club` forwards `payload.image` to `UpdateClubRequest`
    instead of hardcoding `None`.
  - `get_my_club_tables` now merges `get_tables_by_event_id` (legacy
    event-bound) with `get_tables_by_club_id` (club-level tables for the
    owner's club) so the per-event endpoint returns both sets. Without
    this, the manual-reservation modal was empty after the club-level
    tables migration.

### Dashboard

- **`pierre_dashboard/src/components/Sidebar.tsx`** —
  - `NavLink` for "Impostazioni Locale" now uses `end` so it isn't
    highlighted when the route is `/dashboard/club/areas`.
  - New "Tour 360° locale" entry (icon `Compass`) → `/dashboard/club/tour`,
    promoting the action out of the settings page header.
- **`pierre_dashboard/src/context/AuthContext.tsx`** — exposes
  `setClub(club)` and `setOwner(owner)` that update both React state and
  `localStorage`. Internal renames to `setOwnerState` / `setClubState`
  to keep the public API clean. Lets pages refresh the cached profile
  after a successful PUT.
- **`pierre_dashboard/src/pages/EventsPage.tsx`** —
  - Date filter is now an inline `<input type="date">` (`w-37.5`) inside
    the `PageHeader` action, on the same row as "Nuovo evento"
    (`whitespace-nowrap`). Removed the surrounding `SectionCard`.
  - Filter date persists in the URL via `useSearchParams` (`?from=...`).
  - Each event card has a new "Tour 360" button (matching `<button>` —
    not `<Link>` — to share the same `font: inherit` reset and avoid the
    smaller-anchor visual mismatch); navigation handled with
    `useNavigate`.
- **`pierre_dashboard/src/pages/EventReservationsPage.tsx`** —
  - Fetches the event via `GET /events/:id` and shows
    `Prenotazioni · {title}` as the page title with
    `{date · time · venue}` (Italian-formatted via `Intl.DateTimeFormat`)
    as the description.
- **`pierre_dashboard/src/pages/ClubSettingsPage.tsx`** —
  - Removed the gallery section, its handlers (`handleAddImage`,
    `handleDeleteImage`), the `/owner/club/images` fetch, and all
    related state. Backend endpoints untouched.
  - Added a club-image upload as the first form field, reusing
    `EventImageUpload` which posts to `/owner/events/image` and returns
    a URL.
  - On successful PUT, parses the response as `Club` and calls
    `persistClub(updatedClub)` so the sidebar (and any other consumer of
    `useAuth().club`) reflects the change immediately, in addition to
    refetching.
  - Removed the "Configura tour 360°" button from the page header
    (replaced by the sidebar entry).

---

## Files Modified

| Layer | File | Note |
|---|---|---|
| Backend | `rust_BE/src/models/club.rs` | `ClubResponse` now serializes address/phone/website |
| Backend | `rust_BE/src/models/club_owner.rs` | Add `image` to `OwnerUpdateClubRequest` |
| Backend | `rust_BE/src/controllers/club_owner_controller.rs` | Forward image; merge club + event tables |
| Dashboard | `pierre_dashboard/src/components/Sidebar.tsx` | `end` on settings link; new Tour 360 entry |
| Dashboard | `pierre_dashboard/src/context/AuthContext.tsx` | Expose `setClub` / `setOwner` (state + localStorage) |
| Dashboard | `pierre_dashboard/src/pages/EventsPage.tsx` | Inline date filter, querystring, Tour 360 button |
| Dashboard | `pierre_dashboard/src/pages/EventReservationsPage.tsx` | Show event title + date in header |
| Dashboard | `pierre_dashboard/src/pages/ClubSettingsPage.tsx` | Image upload, AuthContext refresh, hide gallery |
