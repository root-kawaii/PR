# 2026-05-07: Dedicated `club-images` Storage Bucket

**Branch**: `claude/fix-club-image-storage-GjF39`
**Status**: Ready for review

---

## Overview

Club logos were being uploaded into the `event-images` bucket via the same
endpoint used for event posters (`POST /owner/events/image`). The dashboard
reused `EventImageUpload` for the club settings form, so club logos and
event locandine were piling up in the same bucket. This is logically wrong
and operationally unsafe: the `event-images` GC cleaner builds its
reference set from `events.image` and `table_images.url` only — it never
looked at `clubs.image`, so the first GC run wiped the existing club
logos.

This change introduces a dedicated `club-images` bucket, a new
`POST /owner/club/image` endpoint, and a matching GC cleaner that uses
`clubs.image` (and `club_images.url`) as its reference set.

---

## Changes

### Backend

- `bootstrap/config.rs`: added `club_images_bucket` to `StorageConfig`,
  reading `SUPABASE_CLUB_IMAGES_BUCKET` (default `club-images`).
- `services/storage_service.rs`: renamed the standalone
  `upload_event_image` to `upload_image_to_bucket` — the function already
  takes the bucket as a parameter; the old name was misleading.
- `controllers/club_image_controller.rs` (new): mirrors
  `event_image_controller.rs` but writes into the new
  `club_images_bucket`.
- `api/routers/owner.rs`: registered `POST /owner/club/image`.
- `services/garbage_collector/storage.rs`: added `run_club_images` and
  `referenced_club_image_paths` (queries both `clubs.image` and
  `club_images.url`).
- `jobs/garbage_collector.rs`: wired `run_club_images` into the GC round
  alongside the existing `event_images` and `panoramas` cleaners.

### Dashboard

- Renamed `components/EventImageUpload.tsx` to `components/ImageUpload.tsx`
  and added a required `uploadEndpoint` prop plus optional `placeholder`
  and `altText`. The endpoint is no longer hardcoded to
  `/owner/events/image`.
- `pages/ClubSettingsPage.tsx`: now uploads to `/owner/club/image`.
- `pages/EventsPage.tsx`: continues to upload to `/owner/events/image`
  via the same component.

### Infrastructure / Notes

- A `club-images` bucket must be created on Supabase (public read,
  service-role write) before deploying. Same policy as `event-images`.
- Optional env var `SUPABASE_CLUB_IMAGES_BUCKET` on Fly.io; default
  `club-images` already matches the planned bucket name.
- No DB migration: `clubs.image` schema is unchanged; only the host /
  bucket portion of the URL changes for new uploads. Existing club logos
  in `event-images` were already deleted by the prior GC run, so no data
  migration is needed.

---

## Files Modified

| Path | Change |
|---|---|
| `rust_BE/src/bootstrap/config.rs` | added `club_images_bucket` field + env parsing |
| `rust_BE/src/services/storage_service.rs` | renamed `upload_event_image` -> `upload_image_to_bucket` |
| `rust_BE/src/controllers/club_image_controller.rs` | **new** handler for club logo upload |
| `rust_BE/src/controllers/event_image_controller.rs` | updated call site to renamed service fn |
| `rust_BE/src/controllers/mod.rs` | exported `club_image_controller` |
| `rust_BE/src/api/routers/owner.rs` | registered `POST /owner/club/image` |
| `rust_BE/src/services/garbage_collector/storage.rs` | added `run_club_images` + reference set |
| `rust_BE/src/jobs/garbage_collector.rs` | wired club-images cleaner into GC round |
| `pierre_dashboard/src/components/ImageUpload.tsx` | renamed from `EventImageUpload`, parametric endpoint |
| `pierre_dashboard/src/pages/ClubSettingsPage.tsx` | uses `/owner/club/image` |
| `pierre_dashboard/src/pages/EventsPage.tsx` | passes `/owner/events/image` explicitly |

---

## Verification

- `cd rust_BE && cargo check` clean.
- `cargo test storage::` — all 9 unit tests in
  `services/garbage_collector/storage.rs` pass.
- `cd pierre_dashboard && npm run build` succeeds.
- Manual end-to-end (post-deploy):
  - Upload a logo from `/dashboard/club` and confirm `clubs.image`
    contains `/storage/v1/object/public/club-images/<club_id>/...`.
  - Upload a locandina from `/dashboard/events` and confirm the URL
    still points at `event-images`.
  - With `GC_ENABLED=true GC_DRY_RUN=true`, log line
    `cleaner = "storage_club_images"` should appear with `detected = 0`
    when the bucket only holds referenced objects.
