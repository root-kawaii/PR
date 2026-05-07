//! Safety-net cleaner: table_images whose table no longer exists.
//! `table_id` already has `ON DELETE CASCADE`.
//!
//! DEPRECATION NOTE: the `table_images` table is slated for removal as part
//! of the table-images redesign. When the table is dropped, delete this
//! cleaner and remove its registration in `services::garbage_collector::mod`
//! and `jobs::garbage_collector::run_round`.

use sqlx::PgPool;
use uuid::Uuid;

use super::{CleanerCtx, CleanerStats, SAMPLE_SIZE};

pub async fn run(pool: &PgPool, ctx: CleanerCtx) -> Result<CleanerStats, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let stats = if ctx.dry_run {
        let detected: i64 = sqlx::query_scalar(
            r#"
            SELECT count(*)::bigint
            FROM table_images ti
            WHERE NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = ti.table_id)
              AND ti.created_at < NOW() - (INTERVAL '1 hour' * $1)
            "#,
        )
        .bind(ctx.min_orphan_age_hours)
        .fetch_one(&mut *tx)
        .await?;

        let sample: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT ti.id FROM table_images ti
            WHERE NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = ti.table_id)
              AND ti.created_at < NOW() - (INTERVAL '1 hour' * $1)
            ORDER BY ti.created_at
            LIMIT $2
            "#,
        )
        .bind(ctx.min_orphan_age_hours)
        .bind(SAMPLE_SIZE as i64)
        .fetch_all(&mut *tx)
        .await?;

        tx.rollback().await?;
        CleanerStats {
            detected: detected as u64,
            deleted: 0,
            sample: sample.into_iter().map(|id| id.to_string()).collect(),
        }
    } else {
        let deleted_ids: Vec<Uuid> = sqlx::query_scalar(
            r#"
            DELETE FROM table_images ti
            WHERE NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = ti.table_id)
              AND ti.created_at < NOW() - (INTERVAL '1 hour' * $1)
            RETURNING ti.id
            "#,
        )
        .bind(ctx.min_orphan_age_hours)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        let deleted = deleted_ids.len() as u64;
        let sample = deleted_ids
            .into_iter()
            .take(SAMPLE_SIZE)
            .map(|id| id.to_string())
            .collect();
        CleanerStats {
            detected: deleted,
            deleted,
            sample,
        }
    };

    tracing::info!(
        cleaner = "table_images_orphans",
        detected = stats.detected,
        deleted = stats.deleted,
        dry_run = ctx.dry_run,
        log_category = "gc",
        "GC cleaner completed"
    );

    Ok(stats)
}
