//! Safety-net cleaner: tables whose event no longer exists.
//! `tables.event_id` already has `ON DELETE CASCADE`.

use sqlx::PgPool;

use super::{CleanerCtx, CleanerStats};

pub async fn run(pool: &PgPool, ctx: CleanerCtx) -> Result<CleanerStats, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let detected: i64 = sqlx::query_scalar(
        r#"
        SELECT count(*)::bigint
        FROM tables t
        WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = t.event_id)
          AND t.created_at < NOW() - (INTERVAL '1 hour' * $1)
        "#,
    )
    .bind(ctx.min_orphan_age_hours)
    .fetch_one(&mut *tx)
    .await?;

    let deleted = if ctx.dry_run {
        0
    } else {
        sqlx::query(
            r#"
            DELETE FROM tables t
            WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = t.event_id)
              AND t.created_at < NOW() - (INTERVAL '1 hour' * $1)
            "#,
        )
        .bind(ctx.min_orphan_age_hours)
        .execute(&mut *tx)
        .await?
        .rows_affected()
    };

    if ctx.dry_run {
        tx.rollback().await?;
    } else {
        tx.commit().await?;
    }

    tracing::info!(
        cleaner = "tables_orphans",
        detected,
        deleted,
        dry_run = ctx.dry_run,
        log_category = "gc",
        "GC cleaner completed"
    );

    Ok(CleanerStats {
        detected: detected as u64,
        deleted,
    })
}
