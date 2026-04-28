use std::sync::Arc;

use serde_json::Value;
use tracing::{error, info};

use crate::bootstrap::state::AppState;

pub mod idempotency_cleanup;
pub mod outbox_dispatcher;
pub mod payment_maintenance;

pub fn start_background_jobs(app_state: Arc<AppState>) {
    let payment_state = Arc::clone(&app_state);
    tokio::spawn(async move {
        payment_maintenance::run(payment_state).await;
    });
    info!("Payment maintenance jobs started");

    let cleanup_state = Arc::clone(&app_state);
    tokio::spawn(async move {
        idempotency_cleanup::run(cleanup_state).await;
    });
    info!("Idempotency cleanup job started");

    let outbox_state = Arc::clone(&app_state);
    tokio::spawn(async move {
        outbox_dispatcher::run(outbox_state).await;
    });
    info!("Outbox dispatcher job started");
}

pub async fn record_job_run(
    state: &AppState,
    job_name: &str,
    status: &str,
    details: Value,
    error_message: Option<&str>,
) {
    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO background_job_runs (
            id, job_name, status, details, error_message, started_at, finished_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
        "#,
    )
    .bind(uuid::Uuid::new_v4())
    .bind(job_name)
    .bind(status)
    .bind(details)
    .bind(error_message)
    .execute(&state.db_pool)
    .await
    {
        error!(job_name, error = %error, "Failed to persist background job run");
    }
}
