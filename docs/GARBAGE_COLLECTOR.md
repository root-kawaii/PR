# Garbage Collector

A daily Tokio background job that detects and removes orphan rows from the
DB and orphan objects from Supabase Storage. Lives in
`rust_BE/src/jobs/garbage_collector.rs` (orchestrator) and
`rust_BE/src/services/garbage_collector/` (cleaners).

---

## Why this exists

Two classes of garbage accumulate in the system:

1. **DB orphans** — rows whose parent has been removed but were not
   cascade-deleted, either because the FK is `ON DELETE SET NULL`
   (`events.club_id` after a club is deleted) or because no FK exists at all
   (`payments` is linked to reservations only via
   `reservation_payment_shares.payment_id`, not by a formal FK).
2. **Storage orphans** — objects in `event-images` and `panoramas` Supabase
   buckets that are no longer referenced from any DB row, e.g. abandoned
   uploads, replaced images that the upload flow forgot to delete, panorama
   scenes removed from a `marzipano_config` after the bucket object was
   created.

The GC sweeps both nightly so neither class compounds.

---

## When and how it runs

- Spawned from `bootstrap::start_background_jobs` only when
  `GC_ENABLED=true`. Otherwise the job logs "Garbage collector disabled
  (GC_ENABLED=false)" at boot and never starts.
- After `GC_FIRST_RUN_DELAY_SECONDS` (default 300 s — gives the rest of the
  app time to settle), the job calls `run_round` and then ticks every
  `GC_INTERVAL_SECONDS` (default 86400 s = 24 h).
- Each round runs every cleaner once, captures per-cleaner failures,
  aggregates totals, and writes one row to `background_job_runs` with
  `job_name = 'garbage_collector'` and a JSON `details` payload.

---

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `GC_ENABLED` | `false` | Master switch. Off by default — must be set to `true` per environment. |
| `GC_DRY_RUN` | `true` | When `true`, cleaners count and roll back instead of deleting. Always start a deployment in dry-run, validate the counts, then flip off. |
| `GC_INTERVAL_SECONDS` | `86400` | Time between rounds. |
| `GC_MIN_ORPHAN_AGE_HOURS` | `24` | Rows / objects younger than this are ignored. Protects in-flight uploads / pending reservations from being misclassified. |
| `GC_FIRST_RUN_DELAY_SECONDS` | `300` | Initial delay before the first round. Avoids saturating the DB at boot. |
| `SUPABASE_PANORAMAS_BUCKET` | `panoramas` | Bucket name for the panorama cleaner; consumed via `StorageConfig`, not a GC-specific var. |

The Supabase storage cleaners additionally require `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. If either is missing the storage cleaner fails
the round with `"SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for
storage GC"` (the DB cleaners still run; status is `partial_failure`).

---

## Cleaners

Each cleaner is a standalone module under
`rust_BE/src/services/garbage_collector/` exposing `pub async fn run(pool,
ctx) -> Result<CleanerStats, _>`. The orchestrator runs them in order;
errors in one do not stop the others.

### DB cleaners (real orphan sources)

| Module | Predicate |
|---|---|
| `events_orphans` | `events WHERE club_id IS NULL` — set when a club is deleted (FK is `ON DELETE SET NULL`). |
| `payments_orphans` | `payments p` where no `reservation_payment_shares.payment_id = p.id`. `payments` has no formal FK. |

### DB cleaners (safety-net)

These tables already have `ON DELETE CASCADE` on their parent FK, so the
cleaner should normally find zero rows. They exist so a future migration
that drops the FK does not silently leak orphans.

| Module | Predicate |
|---|---|
| `tickets_orphans` | `tickets t` where no `events.id = t.event_id`. |
| `reservations_orphans` | `table_reservations r` where event or table no longer exists. |
| `reservation_shares_orphans` | `reservation_payment_shares` orphaned from `table_reservations`. |
| `reservation_guests_orphans` | `reservation_guests` orphaned from `table_reservations`. |
| `table_images_orphans` | `table_images ti` where no `tables.id = ti.table_id`. **DEPRECATED** — see below. |

All DB cleaners apply the `created_at < NOW() - GC_MIN_ORPHAN_AGE_HOURS`
guard and run inside a single transaction. In dry-run mode the transaction
is rolled back; the count + sample are still observed from the rolled-back
snapshot.

### Storage cleaners

| Module fn | Bucket | DB references |
|---|---|---|
| `storage::run_event_images` | `event-images` | `events.image`, `table_images.url` (deprecated source — see note) |
| `storage::run_panoramas` | `panoramas` | `events.marzipano_config[].imageUrl`, `clubs.marzipano_config[].imageUrl` |

**Why both events AND clubs for panoramas**: the mobile viewer falls back to
the club-level `marzipano_config` when the event has none, so panorama
scenes referenced by either source must be preserved. Migration
`042_add_club_marzipano_config.sql` introduced the club-level fallback.

---

## Storage orphan algorithm (in detail)

Pseudocode for `storage::run_bucket`:

```
referenced  = build_reference_set_from_db(bucket)
listed      = list_bucket_recursively(bucket)
candidates  = [obj for obj in listed
                if obj.path NOT IN referenced
                and (obj.created_at < now - min_orphan_age
                     or obj.created_at is null)]

if dry_run:
    return { detected: len(candidates), deleted: 0, sample: candidates[:25] }

for chunk in chunks_of_100(candidates):
    delete_objects(bucket, chunk)
return { detected: len(candidates), deleted: total, sample: candidates[:25] }
```

### Step 1 — building the reference set

For each bucket, query the DB columns that legitimately point at storage
paths and strip the public-URL prefix to obtain a bucket-relative path
(`reference_path_from_url` in `storage.rs`). The function accepts public,
signed (`?token=…` is dropped), and raw object URLs:

- Public: `https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>`
- Signed: `https://<proj>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=…`
- Raw:    `https://<proj>.supabase.co/storage/v1/object/<bucket>/<path>`

URLs that don't match any of these prefixes (e.g. a non-Supabase CDN URL in
`events.image`) are simply not added to the reference set; they cannot
match any listed object in this bucket so they're effectively ignored.

For panoramas, `extract_panorama_urls` walks the JSONB config tolerantly:
it accepts an array of scenes or `{"scenes": [...]}`, and for each scene it
checks `imageUrl`, `image`, then `url` (in that order).

### Step 2 — listing the bucket

`POST /storage/v1/object/list/<bucket>` with body `{prefix, limit, offset}`
and `Authorization: Bearer <service_role_key>`. The Supabase API returns
folder entries with `id: null`; the cleaner pushes them onto a queue and
recurses with `prefix=<folder>/`. Pagination is handled with `limit=1000`
and `offset` until a short page arrives.

### Step 3 — orphan classification

An object is an orphan if and only if:

1. Its bucket-relative path is **not** in the reference set, AND
2. Its `created_at` is **older than** `GC_MIN_ORPHAN_AGE_HOURS` (or absent
   — the reference-set diff is authoritative if Supabase doesn't return a
   timestamp).

The age guard protects in-flight uploads: an upload may complete to storage
seconds before the corresponding DB row is created, so a too-eager GC could
delete legitimate objects.

### Step 4 — deletion

`DELETE /storage/v1/object/<bucket>` with body `{"prefixes": [<path>, …]}`
in chunks of 100. (Supabase calls them "prefixes" but they are full paths,
not glob prefixes.) Failures abort the cleaner with the HTTP status text;
the rest of the round still runs.

---

## Reading the audit (`background_job_runs`)

Each round inserts one row:

```sql
SELECT
  status,
  details,
  started_at,
  finished_at,
  error_message
FROM background_job_runs
WHERE job_name = 'garbage_collector'
ORDER BY created_at DESC
LIMIT 5;
```

`details` is JSON shaped like:

```json
{
  "dry_run": true,
  "min_orphan_age_hours": 24,
  "total_detected": 38,
  "total_deleted": 0,
  "cleaners": {
    "events_orphans": {
      "detected": 30,
      "deleted": 0,
      "sample": [
        "5b2e…",
        "9c1d…"
      ]
    },
    "payments_orphans": { "detected": 0, "deleted": 0, "sample": [] },
    "storage_event_images": {
      "detected": 8,
      "deleted": 0,
      "sample": [
        "club-uuid/abandoned-1.jpg",
        "club-uuid/abandoned-2.jpg"
      ]
    },
    "storage_panoramas": { "detected": 0, "deleted": 0, "sample": [] }
  }
}
```

`status` is one of:

- `success` — every cleaner succeeded. (`total_deleted` may still be 0 in
  dry-run.)
- `partial_failure` — at least one cleaner failed but at least one
  succeeded. The failing cleaner's entry under `cleaners` has an `error`
  field; `error_message` summarizes which cleaners failed.
- `failure` — every cleaner failed.

### Sample field

`sample` contains up to **25 identifiers** per cleaner — UUID strings for
DB cleaners, bucket-relative paths for storage cleaners. In dry-run mode
these are the rows / objects that **would** be deleted on the next live
run; in live mode they are the rows / objects that **were** deleted. Use
this to spot-check the predicate before flipping `GC_DRY_RUN=false`.

The cap of 25 keeps the JSON payload bounded; if more than 25 orphans
exist, sample shows the oldest 25 (DB cleaners ORDER BY `created_at`).

---

## Workflow: dry-run → live

Recommended flow per environment (run staging first):

1. Set `GC_ENABLED=true` and leave `GC_DRY_RUN=true`. Restart the backend.
2. Wait one round (or set `GC_FIRST_RUN_DELAY_SECONDS=10
   GC_INTERVAL_SECONDS=300` for a quick smoke).
3. Inspect `background_job_runs.details`:
   - **Counts plausible?** Compare each cleaner's `detected` to a manual
     SQL audit of the same predicate.
   - **Samples plausible?** Spot-check 2-3 IDs from each `sample` —
     `SELECT * FROM events WHERE id = '<sample-id>'` — to confirm they
     really are orphans by your business rules.
4. If counts + samples look right, set `GC_DRY_RUN=false`. Restart.
5. Wait one round and verify `total_deleted == prior total_detected`,
   modulo new orphans created in between.
6. Roll forward: keep the GC at the daily default, monitor
   `background_job_runs` weekly.

---

## Failure modes and how they're handled

| Symptom | Cause | What the GC does |
|---|---|---|
| One DB cleaner returns `sqlx::Error` | Connection drop, lock timeout | The cleaner's entry has `"error": "..."`; the round status becomes `partial_failure`; remaining cleaners run normally; next round retries. |
| Storage cleaner returns `Err(String)` | Missing Supabase env, HTTP 4xx/5xx, JSON decode failure | Same — `partial_failure`; DB cleaners unaffected. |
| Bucket list paginates indefinitely | Misbehaving Supabase pagination | Each page is `limit=1000`; the loop terminates when a page returns < 1000 items. No infinite-loop guard beyond that — if Supabase ever serves duplicate pages, this would re-list forever. Watch the round duration. |
| GC catches a freshly-uploaded object whose DB row hasn't landed yet | Race between storage upload and DB insert | The `min_orphan_age_hours` guard (default 24 h) blocks this. Don't lower below the worst-case upload-to-row latency. |

---

## Edge cases and known limitations

- **Non-Supabase URLs in `events.image`** (e.g. an external CDN) — they
  don't match the storage URL prefix, so they're silently dropped from the
  reference set. This is fine because they also don't match any listed
  bucket object. If a misconfigured row points at the *raw* path of a real
  Supabase object instead of its public URL, the prefix-matching won't
  catch it; the GC could then misclassify the object as orphan. We accept
  this — fix the misconfigured row.
- **`table_images` deprecation** — the table is slated for removal but is
  still actively written by `club_owner_persistence`. Until it's dropped,
  both the safety-net `table_images_orphans` cleaner and the
  `SELECT url FROM table_images` query inside `storage::run_event_images`
  must stay; otherwise still-linked storage objects would be deleted.
  When the table is dropped, remove:
  - `services/garbage_collector/table_images_orphans.rs`
  - the module declaration in `services/garbage_collector/mod.rs`
  - the `record_db("table_images_orphans", ...)` call in
    `jobs/garbage_collector.rs`
  - the `table_images` query and concatenation in
    `storage::referenced_event_image_paths`
- **Events with `club_id IS NULL` are deleted indiscriminately** — there
  is no whitelist for "system" or "demo" events. If a future use case
  needs a NULL `club_id` to be valid, gate `events_orphans` on a flag
  column or change the predicate.
- **The panoramas reference set ignores hotspots** — `marzipano_config`
  scenes have a `hotspots[]` array that may carry images in some future
  schema. Today only `imageUrl`/`image`/`url` on the scene root is read.
  Update `extract_panorama_urls` if hotspot images become a real source.

---

## Adding a new cleaner

1. Create `rust_BE/src/services/garbage_collector/<name>_orphans.rs` —
   copy `events_orphans.rs` as a template. Keep the
   `dry_run` / `RETURNING id` / `SAMPLE_SIZE` shape.
2. Register the module in `services/garbage_collector/mod.rs`:
   `pub mod <name>_orphans;`.
3. Wire it into `jobs/garbage_collector.rs::run_round` with another
   `record_db(...)` (or `record_storage(...)` for a bucket cleaner).
4. If the cleaner needs new env vars, add them to
   `bootstrap/config.rs::GcConfig` next to the existing ones.
5. Add unit tests for any pure helpers (URL parsing, JSON walking) at
   the bottom of the file.

The `CleanerStats` shape — `{detected, deleted, sample}` — is intentionally
narrow. Resist adding domain-specific fields; if you need more visibility,
log structured fields via `tracing::info!(cleaner = "...", ...)` so they
show up in the round-completion log without bloating the audit JSON.

---

## Testing

Logic-only unit tests live at the bottom of
`rust_BE/src/services/garbage_collector/storage.rs` and cover the
non-trivial pure helpers:

- `reference_path_from_url` — public, signed, and cross-bucket URLs.
- `extract_panorama_urls` — array-of-scenes and `{"scenes": [...]}` shapes.
- `diff_orphans` — referenced-set / age filter combination.
- `chunk_for_delete` — batching at 100.

Run with `cargo test --bin rust_BE garbage_collector`.

DB-backed tests per cleaner (insert a known orphan, run the cleaner,
assert detection + dry-run rollback) are deferred — the repo does not yet
have `sqlx::test` infrastructure. Tracked as a follow-up.
