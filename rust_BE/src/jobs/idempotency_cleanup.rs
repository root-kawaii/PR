use std::sync::Arc;

use serde_json::json;
use tracing::{error, info};

use crate::bootstrap::state::AppState;

pub async fn run(state: Arc<AppState>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
        state.config.jobs.idempotency_cleanup_interval_seconds,
    ));

    loop {
        interval.tick().await;

        match sqlx::query("SELECT cleanup_expired_idempotency_keys()")
            .execute(&state.db_pool)
            .await
        {
            Ok(result) => {
                let rows = result.rows_affected();
                if rows > 0 {
                    info!(deleted_records = rows, "Idempotency cleanup completed");
                }
                crate::jobs::record_job_run(
                    &state,
                    "idempotency_cleanup",
                    "success",
                    json!({ "deleted_records": rows }),
                    None,
                )
                .await;
            }
            Err(e) => {
                error!(error = %e, "Idempotency cleanup failed");
                crate::jobs::record_job_run(
                    &state,
                    "idempotency_cleanup",
                    "failure",
                    json!({}),
                    Some(&e.to_string()),
                )
                .await;
            }
        }
    }
}
