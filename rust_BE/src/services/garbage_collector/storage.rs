//! Storage bucket cleaners for Supabase.
//!
//! Algorithm (shared by both buckets):
//! 1. Build the set of referenced storage paths from the DB.
//! 2. List the bucket recursively via Supabase Storage REST API.
//! 3. Mark as orphans the listed objects whose path is not referenced and
//!    whose `created_at` is older than `min_orphan_age_hours`.
//! 4. In dry-run mode, stop. Otherwise batch-delete the orphans.
//!
//! Helpers below (URL parsing, scene extraction, set diff, chunking) are
//! pure functions covered by unit tests at the bottom of this file.

use std::collections::HashSet;

use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;

use super::{CleanerCtx, CleanerStats, SAMPLE_SIZE};
use crate::bootstrap::config::StorageConfig;

const DELETE_BATCH_SIZE: usize = 100;
const LIST_PAGE_SIZE: i64 = 1000;

#[derive(Debug, Deserialize)]
struct ListedObject {
    name: String,
    /// `id` is null for "folder" entries.
    id: Option<String>,
    created_at: Option<String>,
}

pub async fn run_event_images(
    pool: &PgPool,
    http: &reqwest::Client,
    storage: &StorageConfig,
    ctx: CleanerCtx,
) -> Result<CleanerStats, String> {
    let (supabase_url, service_key) = require_storage(storage)?;
    let bucket = storage.event_images_bucket.as_str();

    let referenced = referenced_event_image_paths(pool, supabase_url, bucket).await?;

    run_bucket(
        http,
        supabase_url,
        service_key,
        bucket,
        "storage_event_images",
        &referenced,
        ctx,
    )
    .await
}

pub async fn run_panoramas(
    pool: &PgPool,
    http: &reqwest::Client,
    storage: &StorageConfig,
    bucket: &str,
    ctx: CleanerCtx,
) -> Result<CleanerStats, String> {
    let (supabase_url, service_key) = require_storage(storage)?;

    let referenced = referenced_panorama_paths(pool, supabase_url, bucket).await?;

    run_bucket(
        http,
        supabase_url,
        service_key,
        bucket,
        "storage_panoramas",
        &referenced,
        ctx,
    )
    .await
}

fn require_storage(storage: &StorageConfig) -> Result<(&str, &str), String> {
    match (
        storage.supabase_url.as_deref(),
        storage.supabase_service_role_key.as_deref(),
    ) {
        (Some(url), Some(key)) => Ok((url, key)),
        _ => Err("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for storage GC".into()),
    }
}

async fn run_bucket(
    http: &reqwest::Client,
    supabase_url: &str,
    service_key: &str,
    bucket: &str,
    cleaner_name: &'static str,
    referenced: &HashSet<String>,
    ctx: CleanerCtx,
) -> Result<CleanerStats, String> {
    let listed = list_bucket_recursive(http, supabase_url, service_key, bucket).await?;
    let now = Utc::now();
    let min_age = Duration::hours(ctx.min_orphan_age_hours);
    let candidates = diff_orphans(&listed, referenced, min_age, now);
    let detected = candidates.len() as u64;
    let sample: Vec<String> = candidates.iter().take(SAMPLE_SIZE).cloned().collect();

    let deleted = if ctx.dry_run {
        0
    } else {
        let mut total = 0u64;
        for chunk in chunk_for_delete(&candidates, DELETE_BATCH_SIZE) {
            total += delete_objects(http, supabase_url, service_key, bucket, chunk).await?;
        }
        total
    };

    tracing::info!(
        cleaner = cleaner_name,
        bucket,
        detected,
        deleted,
        dry_run = ctx.dry_run,
        log_category = "gc",
        "GC cleaner completed"
    );

    Ok(CleanerStats {
        detected,
        deleted,
        sample,
    })
}

async fn referenced_event_image_paths(
    pool: &PgPool,
    supabase_url: &str,
    bucket: &str,
) -> Result<HashSet<String>, String> {
    let event_rows: Vec<(Option<String>,)> =
        sqlx::query_as("SELECT image FROM events WHERE image IS NOT NULL AND image <> ''")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("failed to load event images: {e}"))?;

    // DEPRECATION NOTE: `table_images` is slated for removal. While the table
    // still exists and is written by club_owner_persistence, its URLs must
    // remain in the reference set so we don't delete still-linked storage
    // objects. Drop this query once the table is removed.
    let table_rows: Vec<(String,)> =
        sqlx::query_as("SELECT url FROM table_images WHERE url IS NOT NULL AND url <> ''")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("failed to load table images: {e}"))?;

    let mut set = HashSet::new();
    for (url,) in event_rows.into_iter().filter_map(|(u,)| u.map(|u| (u,))) {
        if let Some(p) = reference_path_from_url(&url, supabase_url, bucket) {
            set.insert(p);
        }
    }
    for (url,) in table_rows {
        if let Some(p) = reference_path_from_url(&url, supabase_url, bucket) {
            set.insert(p);
        }
    }
    Ok(set)
}

async fn referenced_panorama_paths(
    pool: &PgPool,
    supabase_url: &str,
    bucket: &str,
) -> Result<HashSet<String>, String> {
    // Both events and clubs carry a `marzipano_config` JSONB array. The
    // mobile viewer falls back to the club's config when the event has none,
    // so panorama scenes referenced by either source must be preserved.
    let event_rows: Vec<(Option<Value>,)> =
        sqlx::query_as("SELECT marzipano_config FROM events WHERE marzipano_config IS NOT NULL")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("failed to load event marzipano configs: {e}"))?;
    let club_rows: Vec<(Option<Value>,)> =
        sqlx::query_as("SELECT marzipano_config FROM clubs WHERE marzipano_config IS NOT NULL")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("failed to load club marzipano configs: {e}"))?;

    let mut set = HashSet::new();
    for (cfg,) in event_rows.into_iter().chain(club_rows) {
        if let Some(cfg) = cfg {
            for url in extract_panorama_urls(&cfg) {
                if let Some(p) = reference_path_from_url(&url, supabase_url, bucket) {
                    set.insert(p);
                }
            }
        }
    }
    Ok(set)
}

async fn list_bucket_recursive(
    http: &reqwest::Client,
    supabase_url: &str,
    service_key: &str,
    bucket: &str,
) -> Result<Vec<(String, Option<DateTime<Utc>>)>, String> {
    let mut out: Vec<(String, Option<DateTime<Utc>>)> = Vec::new();
    let mut prefixes: Vec<String> = vec![String::new()];

    while let Some(prefix) = prefixes.pop() {
        let mut offset = 0i64;
        loop {
            let body = json!({
                "prefix": prefix,
                "limit": LIST_PAGE_SIZE,
                "offset": offset,
            });
            let url = format!("{supabase_url}/storage/v1/object/list/{bucket}");
            let resp = http
                .post(&url)
                .header("Authorization", format!("Bearer {service_key}"))
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("list request failed: {e}"))?;
            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(format!("list returned HTTP {status}: {text}"));
            }
            let items: Vec<ListedObject> = resp
                .json()
                .await
                .map_err(|e| format!("list json decode failed: {e}"))?;
            let count = items.len() as i64;
            for item in items {
                let full = if prefix.is_empty() {
                    item.name.clone()
                } else {
                    format!("{prefix}/{}", item.name)
                };
                if item.id.is_none() {
                    // folder — recurse
                    prefixes.push(full);
                } else {
                    let created = item.created_at.as_deref().and_then(parse_rfc3339);
                    out.push((full, created));
                }
            }
            if count < LIST_PAGE_SIZE {
                break;
            }
            offset += count;
        }
    }
    Ok(out)
}

async fn delete_objects(
    http: &reqwest::Client,
    supabase_url: &str,
    service_key: &str,
    bucket: &str,
    paths: &[String],
) -> Result<u64, String> {
    if paths.is_empty() {
        return Ok(0);
    }
    let url = format!("{supabase_url}/storage/v1/object/{bucket}");
    let body = json!({ "prefixes": paths });
    let resp = http
        .delete(&url)
        .header("Authorization", format!("Bearer {service_key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("delete request failed: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("delete returned HTTP {status}: {text}"));
    }
    Ok(paths.len() as u64)
}

// --- pure helpers (unit-tested below) ---

/// Strip the Supabase public-URL prefix and return the bucket-relative path.
/// Returns `None` if the URL is not a Supabase URL for this bucket, or if it
/// does not look like a Supabase storage URL (in which case the value lives
/// somewhere else and should not be considered a referenced bucket object).
fn reference_path_from_url(url: &str, supabase_url: &str, bucket: &str) -> Option<String> {
    let base = supabase_url.trim_end_matches('/');
    let public_prefix = format!("{base}/storage/v1/object/public/{bucket}/");
    let signed_prefix = format!("{base}/storage/v1/object/sign/{bucket}/");
    let raw_prefix = format!("{base}/storage/v1/object/{bucket}/");
    let trimmed = url.trim();
    let stripped = trimmed
        .strip_prefix(&public_prefix)
        .or_else(|| trimmed.strip_prefix(&signed_prefix))
        .or_else(|| trimmed.strip_prefix(&raw_prefix))?;
    // Drop query string from signed URLs.
    let path = stripped.split('?').next().unwrap_or(stripped);
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

/// Extract `scenes[].imageUrl` strings from a marzipano_config JSONB value.
/// Tolerant to slight schema variations: also accepts `image` and `url` keys.
fn extract_panorama_urls(cfg: &Value) -> Vec<String> {
    let mut out = Vec::new();
    let scenes = match cfg {
        Value::Array(arr) => arr.as_slice(),
        Value::Object(map) => {
            // `{ "scenes": [...] }` shape
            if let Some(Value::Array(arr)) = map.get("scenes") {
                arr.as_slice()
            } else {
                return out;
            }
        }
        _ => return out,
    };
    for scene in scenes {
        let Some(obj) = scene.as_object() else {
            continue;
        };
        for key in ["imageUrl", "image", "url"] {
            if let Some(Value::String(s)) = obj.get(key) {
                if !s.is_empty() {
                    out.push(s.clone());
                    break;
                }
            }
        }
    }
    out
}

/// Compute orphan candidates: listed objects that are not in `referenced`
/// and whose `created_at` is older than `min_age` (objects with no
/// `created_at` are still considered candidates — the referenced-set diff
/// is authoritative).
fn diff_orphans(
    listed: &[(String, Option<DateTime<Utc>>)],
    referenced: &HashSet<String>,
    min_age: Duration,
    now: DateTime<Utc>,
) -> Vec<String> {
    let cutoff = now - min_age;
    listed
        .iter()
        .filter(|(path, created)| {
            if referenced.contains(path) {
                return false;
            }
            match created {
                Some(c) => *c < cutoff,
                None => true,
            }
        })
        .map(|(path, _)| path.clone())
        .collect()
}

fn chunk_for_delete(paths: &[String], chunk_size: usize) -> impl Iterator<Item = &[String]> {
    paths.chunks(chunk_size.max(1))
}

fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reference_path_from_public_url() {
        let url = "https://abc.supabase.co/storage/v1/object/public/event-images/club-1/abc.jpg";
        let got = reference_path_from_url(url, "https://abc.supabase.co", "event-images");
        assert_eq!(got, Some("club-1/abc.jpg".into()));
    }

    #[test]
    fn reference_path_from_signed_url_drops_query() {
        let url =
            "https://abc.supabase.co/storage/v1/object/sign/panoramas/scene/file.jpg?token=xyz";
        let got = reference_path_from_url(url, "https://abc.supabase.co", "panoramas");
        assert_eq!(got, Some("scene/file.jpg".into()));
    }

    #[test]
    fn reference_path_returns_none_for_other_buckets() {
        let url = "https://abc.supabase.co/storage/v1/object/public/other/x.jpg";
        let got = reference_path_from_url(url, "https://abc.supabase.co", "event-images");
        assert_eq!(got, None);
    }

    #[test]
    fn reference_path_returns_none_for_non_supabase_url() {
        let url = "https://example.com/foo.jpg";
        let got = reference_path_from_url(url, "https://abc.supabase.co", "event-images");
        assert_eq!(got, None);
    }

    #[test]
    fn extract_scenes_array_shape() {
        let cfg = json!([
            { "id": "a", "imageUrl": "https://abc.supabase.co/storage/v1/object/public/panoramas/a.jpg" },
            { "id": "b", "imageUrl": "https://abc.supabase.co/storage/v1/object/public/panoramas/b.jpg" },
        ]);
        let got = extract_panorama_urls(&cfg);
        assert_eq!(got.len(), 2);
        assert!(got[0].ends_with("/a.jpg"));
        assert!(got[1].ends_with("/b.jpg"));
    }

    #[test]
    fn extract_scenes_object_shape() {
        let cfg = json!({
            "scenes": [{ "imageUrl": "x.jpg" }, { "image": "y.jpg" }, { "url": "z.jpg" }],
        });
        let got = extract_panorama_urls(&cfg);
        assert_eq!(got, vec!["x.jpg", "y.jpg", "z.jpg"]);
    }

    #[test]
    fn extract_scenes_skips_empty_and_unknown() {
        let cfg = json!([{ "imageUrl": "" }, { "noUrl": true }]);
        let got = extract_panorama_urls(&cfg);
        assert!(got.is_empty());
    }

    #[test]
    fn diff_orphans_filters_referenced_and_too_young() {
        let now = Utc::now();
        let referenced: HashSet<String> = ["keep.jpg".into()].into_iter().collect();
        let listed = vec![
            ("keep.jpg".into(), Some(now - Duration::hours(48))),
            ("old-orphan.jpg".into(), Some(now - Duration::hours(48))),
            ("young-orphan.jpg".into(), Some(now - Duration::hours(1))),
            ("no-ts-orphan.jpg".into(), None),
        ];
        let got = diff_orphans(&listed, &referenced, Duration::hours(24), now);
        assert_eq!(
            got.into_iter().collect::<HashSet<_>>(),
            ["old-orphan.jpg".into(), "no-ts-orphan.jpg".into()]
                .into_iter()
                .collect::<HashSet<_>>()
        );
    }

    #[test]
    fn chunk_for_delete_respects_size() {
        let paths: Vec<String> = (0..250).map(|i| format!("p{i}")).collect();
        let chunks: Vec<&[String]> = chunk_for_delete(&paths, 100).collect();
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].len(), 100);
        assert_eq!(chunks[1].len(), 100);
        assert_eq!(chunks[2].len(), 50);
    }
}
