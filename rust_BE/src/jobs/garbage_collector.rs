//! Daily garbage collection orchestrator.
//!
//! Runs each cleaner in `services::garbage_collector` and records one
//! `background_job_runs` row per round with per-cleaner counts. A failure in
//! one cleaner does not stop the others.

use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Map, Value};
use tracing::{error, info};

use crate::bootstrap::state::AppState;
use crate::services::garbage_collector::{
    events_orphans, payments_orphans, reservation_guests_orphans, reservation_shares_orphans,
    reservations_orphans, storage, table_images_orphans, tables_orphans, tickets_orphans,
    CleanerCtx, CleanerStats,
};

pub async fn run(state: Arc<AppState>) {
    let cfg = &state.config.gc;
    let first_delay = Duration::from_secs(cfg.first_run_delay_seconds);
    if !first_delay.is_zero() {
        tokio::time::sleep(first_delay).await;
    }
    let mut interval = tokio::time::interval(Duration::from_secs(cfg.interval_seconds));
    // First tick fires immediately after the initial sleep; subsequent ticks
    // are spaced by `interval_seconds`.
    loop {
        interval.tick().await;
        run_round(&state).await;
    }
}

async fn run_round(state: &AppState) {
    let cfg = &state.config.gc;
    let ctx = CleanerCtx {
        dry_run: cfg.dry_run,
        min_orphan_age_hours: cfg.min_orphan_age_hours,
    };

    let mut details: Map<String, Value> = Map::new();
    let mut total_detected: u64 = 0;
    let mut total_deleted: u64 = 0;
    let mut succeeded: u32 = 0;
    let mut failed: Vec<String> = Vec::new();

    record_db(
        "events_orphans",
        events_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "payments_orphans",
        payments_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "tickets_orphans",
        tickets_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "tables_orphans",
        tables_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "reservations_orphans",
        reservations_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "reservation_shares_orphans",
        reservation_shares_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "reservation_guests_orphans",
        reservation_guests_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );
    record_db(
        "table_images_orphans",
        table_images_orphans::run(&state.db_pool, ctx).await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );

    record_storage(
        "storage_event_images",
        storage::run_event_images(
            &state.db_pool,
            &state.http_client,
            &state.config.storage,
            ctx,
        )
        .await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );

    record_storage(
        "storage_panoramas",
        storage::run_panoramas(
            &state.db_pool,
            &state.http_client,
            &state.config.storage,
            &state.config.storage.panoramas_bucket,
            ctx,
        )
        .await,
        &mut details,
        &mut total_detected,
        &mut total_deleted,
        &mut succeeded,
        &mut failed,
    );

    let status = if failed.is_empty() {
        "success"
    } else if succeeded == 0 {
        "failure"
    } else {
        "partial_failure"
    };

    info!(
        log_category = "gc",
        dry_run = ctx.dry_run,
        total_detected,
        total_deleted,
        failed_cleaners = ?failed,
        "GC round completed"
    );

    let error_summary = if failed.is_empty() {
        None
    } else {
        Some(format!("failed cleaners: {}", failed.join(", ")))
    };
    crate::jobs::record_job_run(
        state,
        "garbage_collector",
        status,
        json!({
            "dry_run": ctx.dry_run,
            "min_orphan_age_hours": ctx.min_orphan_age_hours,
            "total_detected": total_detected,
            "total_deleted": total_deleted,
            "cleaners": Value::Object(details),
        }),
        error_summary.as_deref(),
    )
    .await;
}

fn record_db(
    name: &str,
    result: Result<CleanerStats, sqlx::Error>,
    details: &mut Map<String, Value>,
    total_detected: &mut u64,
    total_deleted: &mut u64,
    succeeded: &mut u32,
    failed: &mut Vec<String>,
) {
    match result {
        Ok(stats) => {
            *total_detected += stats.detected;
            *total_deleted += stats.deleted;
            *succeeded += 1;
            details.insert(
                name.into(),
                json!({ "detected": stats.detected, "deleted": stats.deleted }),
            );
        }
        Err(e) => {
            error!(cleaner = name, error = %e, log_category = "gc", "GC cleaner failed");
            failed.push(name.into());
            details.insert(name.into(), json!({ "error": e.to_string() }));
        }
    }
}

fn record_storage(
    name: &str,
    result: Result<CleanerStats, String>,
    details: &mut Map<String, Value>,
    total_detected: &mut u64,
    total_deleted: &mut u64,
    succeeded: &mut u32,
    failed: &mut Vec<String>,
) {
    match result {
        Ok(stats) => {
            *total_detected += stats.detected;
            *total_deleted += stats.deleted;
            *succeeded += 1;
            details.insert(
                name.into(),
                json!({ "detected": stats.detected, "deleted": stats.deleted }),
            );
        }
        Err(e) => {
            error!(cleaner = name, error = %e, log_category = "gc", "GC cleaner failed");
            failed.push(name.into());
            details.insert(name.into(), json!({ "error": e }));
        }
    }
}
