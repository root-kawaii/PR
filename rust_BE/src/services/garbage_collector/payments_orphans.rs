//! Cleans `payments` rows that no `reservation_payment_shares` references.
//! `payments` has no formal FK; this is a real orphan source.

use sqlx::PgPool;

use super::{CleanerCtx, CleanerStats};

pub async fn run(pool: &PgPool, ctx: CleanerCtx) -> Result<CleanerStats, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let detected: i64 = sqlx::query_scalar(
        r#"
        SELECT count(*)::bigint
        FROM payments p
        WHERE NOT EXISTS (
            SELECT 1 FROM reservation_payment_shares s WHERE s.payment_id = p.id
        )
        AND p.insert_date < NOW() - (INTERVAL '1 hour' * $1)
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
            DELETE FROM payments p
            WHERE NOT EXISTS (
                SELECT 1 FROM reservation_payment_shares s WHERE s.payment_id = p.id
            )
            AND p.insert_date < NOW() - (INTERVAL '1 hour' * $1)
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
        cleaner = "payments_orphans",
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
