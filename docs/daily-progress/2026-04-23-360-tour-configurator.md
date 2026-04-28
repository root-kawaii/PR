# 2026-04-23: Dashboard 360° Tour Configurator (club + event scope)

**Branch**: `claude/add-360-view-configurator-3fVkt`
**Status**: Done — `cargo check` ✅, `npm run build` ✅, rebased onto `main` 2026-04-28

---

## Overview

Before today the mobile 360° viewer (Marzipano in a WebView) consumed an
`events.marzipano_config` JSONB that was **populated by hand via SQL
migrations**. Club owners had no way to set up or edit their venue tour.

This change ships a full configurator in the dashboard:

- **Per-club tour** — new `clubs.marzipano_config` JSONB (migration 042).
  The mobile viewer now falls back from the event's config to the club's
  config, so one tour can be shared across every event at the venue.
- **Per-event override** — existing `events.marzipano_config` still wins
  when present, letting an owner ship a bespoke tour for a specific night.
- **Visual editor** — click-to-place hotspots on the equirectangular
  panorama, drag to reposition, pick type (`table` / `scene-link` / `area`),
  bind to a real table or area, upload the 360 JPG directly from the browser.
- **Panorama upload** — new `POST /owner/uploads/panorama` endpoint that
  forwards the multipart body to Supabase Storage using the service-role
  key, returns the public URL for the JSON config.
- **Mobile area hotspots** — the viewer.html + `MarzipanoViewer` bridge
  now recognise `type: 'area'` and emit an `AREA_CLICK` message.

---

## Changes

### Database
`DB/migrations/042_add_club_marzipano_config.sql` — new column
`clubs.marzipano_config JSONB` plus a GIN index. No change to existing
tables/areas columns (migrations 025/033 already covered them).

### Backend (`rust_BE`)

- `Cargo.toml` — enabled the `multipart` feature on `axum`.
- `models/club.rs` — added `marzipano_config: Option<JsonValue>` to `Club`
  and surfaced it in `ClubResponse` as `marzipanoScenes` (camelCase,
  mirrors the event response).
- `infrastructure/repositories/club_persistence.rs` — every `SELECT *`
  now pulls the new column; added `update_marzipano_config`.
- `infrastructure/repositories/event_persistence.rs` — new
  `update_marzipano_config` helper (targeted `UPDATE`, independent of the
  generic `update_event`).
- `infrastructure/repositories/table_persistence.rs` — new
  `update_marzipano_position`.
- `infrastructure/repositories/area_persistence.rs` — new
  `update_marzipano_position`.
- `bootstrap/config.rs` — new `StorageConfig` (Supabase URL, service key,
  bucket name, max size) sourced from env.
- `bootstrap/state.rs` — `AppState` now holds `storage: Arc<StorageService>`.
- `services/storage_service.rs` (new) — thin Supabase Storage client
  using `reqwest`, uploads to `clubs/{id}/panoramas/{uuid}-{name}` and
  returns the public URL.
- `controllers/club_owner_controller.rs` — 3 new handlers:
  - `update_club_marzipano_config_handler` (PUT)
  - `update_event_marzipano_config_handler` (PUT, ownership-checked)
  - `upload_panorama_handler` (multipart POST)
- `controllers/event_controller.rs` — `get_event` now falls back to the
  club's `marzipano_config` when the event's is null.
- `api/routers/owner.rs` — wired the 3 new routes.

### Dashboard (`pierre_dashboard`)

- `public/marzipano.js` (new) — exact copy of the mobile library so
  editor and runtime share the same yaw/pitch coordinate system.
- `src/hooks/useMarzipano.ts` (new) — loads the script once, exposes
  typed handles (`Viewer`, `Scene`, `View`, `Hotspot`).
- `src/components/tour/` (new)
  - `MarzipanoCanvas.tsx` — mounts the viewer, handles click-to-place,
    pointer-drag of hotspots, scene switching, DOM overlays.
  - `SceneList.tsx` — left sidebar (add/rename/delete/select scenes).
  - `HotspotInspector.tsx` — right panel (type selector, table/area/scene
    dropdowns, arm-to-place toggle, position readout, delete).
  - `SceneSettingsModal.tsx` — scene name, panorama upload (`POST
    /owner/uploads/panorama`) with URL fallback, "use current view".
  - `CreateAreaModal.tsx` — inline `POST /owner/areas`.
  - `TourConfigurator.tsx` — top-level reducer + layout, shared between
    club and event pages.
- `src/pages/ClubTourConfigPage.tsx` (new) — `/dashboard/club/tour`.
- `src/pages/EventTourConfigPage.tsx` (new) —
  `/dashboard/events/:eventId/tour`, shows an override banner and offers
  "reset to inherited".
- `src/App.tsx` — registered the two new routes.
- `src/pages/ClubSettingsPage.tsx` — "Configura tour 360°" button.
- `src/pages/EventTablesPage.tsx` — "Tour 360°" button next to
  "Prenotazioni".
- `src/types/index.ts` — mirror of the mobile Marzipano types,
  `Club.marzipanoScenes`, `Area`, `TourConfigPayload`.

### Mobile (`pierre_two`)

- `types/index.ts` — `MarzipanoHotspot.type` extended to
  `'table' | 'scene-link' | 'area'` with `areaId`/`areaName` fields.
- `assets/marzipano/viewer.html` — new branch for `type === 'area'`
  (styled amber pin, posts an `AREA_CLICK` message), plus CSS.
- `components/event/MarzipanoViewer.tsx` — `onAreaClick` prop, wiring
  for the `AREA_CLICK` message, preserves `areaId`/`areaName` when
  serialising scenes into the WebView.

---

## Environment

Add these to `rust_BE/.env`:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_PANORAMAS_BUCKET=panoramas    # optional, defaults to "panoramas"
MAX_PANORAMA_BYTES=52428800            # optional, defaults to 50 MB
```

Create a **public-read** bucket named `panoramas` in Supabase Studio
before enabling upload; otherwise the mobile WebView can't fetch the JPG.

---

## Files Modified

| File | Change |
|---|---|
| `DB/migrations/042_add_club_marzipano_config.sql` | new |
| `rust_BE/Cargo.toml` | enabled `axum/multipart` |
| `rust_BE/src/models/club.rs` | added `marzipano_config` |
| `rust_BE/src/bootstrap/config.rs` | added `StorageConfig` |
| `rust_BE/src/bootstrap/state.rs` | wired `StorageService` |
| `rust_BE/src/services/storage_service.rs` | new (Supabase upload) |
| `rust_BE/src/infrastructure/repositories/club_persistence.rs` | column + update fn |
| `rust_BE/src/infrastructure/repositories/event_persistence.rs` | update fn |
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | update fn |
| `rust_BE/src/infrastructure/repositories/area_persistence.rs` | update fn |
| `rust_BE/src/controllers/club_owner_controller.rs` | 3 new handlers |
| `rust_BE/src/controllers/event_controller.rs` | club-fallback helper |
| `rust_BE/src/api/routers/owner.rs` | 3 new routes |
| `pierre_dashboard/public/marzipano.js` | new (library copy) |
| `pierre_dashboard/src/hooks/useMarzipano.ts` | new |
| `pierre_dashboard/src/components/tour/*.tsx` | new (6 files) |
| `pierre_dashboard/src/pages/ClubTourConfigPage.tsx` | new |
| `pierre_dashboard/src/pages/EventTourConfigPage.tsx` | new |
| `pierre_dashboard/src/App.tsx` | routes |
| `pierre_dashboard/src/pages/ClubSettingsPage.tsx` | nav button |
| `pierre_dashboard/src/pages/EventTablesPage.tsx` | nav button |
| `pierre_dashboard/src/types/index.ts` | Marzipano + Area types |
| `pierre_two/types/index.ts` | `'area'` hotspot |
| `pierre_two/assets/marzipano/viewer.html` | area branch + CSS |
| `pierre_two/components/event/MarzipanoViewer.tsx` | `onAreaClick` |
