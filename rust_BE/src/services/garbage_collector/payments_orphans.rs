//! Cleans `payments` rows that no `reservation_payment_shares` references.
//! `payments` has no formal FK; this is a real orphan source.

use sqlx::PgPool;
use uuid::Uuid;

use super::{CleanerCtx, CleanerStats, SAMPLE_SIZE};

pub async fn run(pool: &PgPool, ctx: CleanerCtx) -> Result<CleanerStats, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let stats = if ctx.dry_run {
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

        let sample: Vec<Uuid> = sqlx::query_scalar(
            r#"
            SELECT p.id FROM payments p
            WHERE NOT EXISTS (
                SELECT 1 FROM reservation_payment_shares s WHERE s.payment_id = p.id
            )
            AND p.insert_date < NOW() - (INTERVAL '1 hour' * $1)
            ORDER BY p.insert_date
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
            DELETE FROM payments p
            WHERE NOT EXISTS (
                SELECT 1 FROM reservation_payment_shares s WHERE s.payment_id = p.id
            )
            AND p.insert_date < NOW() - (INTERVAL '1 hour' * $1)
            RETURNING id
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
        cleaner = "payments_orphans",
        detected = stats.detected,
        deleted = stats.deleted,
        dry_run = ctx.dry_run,
        log_category = "gc",
        "GC cleaner completed"
    );

    Ok(stats)
}
