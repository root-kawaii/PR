//! Safety-net cleaner: table reservations whose event or table no longer exists.
//! Both FKs already have `ON DELETE CASCADE`.

use sqlx::PgPool;

use super::{CleanerCtx, CleanerStats};

pub async fn run(pool: &PgPool, ctx: CleanerCtx) -> Result<CleanerStats, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let detected: i64 = sqlx::query_scalar(
        r#"
        SELECT count(*)::bigint
        FROM table_reservations r
        WHERE (
            NOT EXISTS (SELECT 1 FROM events e WHERE e.id = r.event_id)
            OR NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = r.table_id)
        )
        AND r.created_at < NOW() - (INTERVAL '1 hour' * $1)
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
            DELETE FROM table_reservations r
            WHERE (
                NOT EXISTS (SELECT 1 FROM events e WHERE e.id = r.event_id)
                OR NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = r.table_id)
            )
            AND r.created_at < NOW() - (INTERVAL '1 hour' * $1)
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
        cleaner = "reservations_orphans",
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
