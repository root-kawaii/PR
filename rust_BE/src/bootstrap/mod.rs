pub mod config;
pub mod state;

use std::sync::Arc;

use sqlx::PgPool;
use tracing::info;

use crate::bootstrap::config::AppConfig;
use crate::bootstrap::state::AppState;
use crate::idempotency::{IdempotencyConfig, IdempotencyService};

pub async fn create_pool(config: &AppConfig) -> PgPool {
    PgPool::connect(&config.database_url)
        .await
        .expect("Failed to connect to Postgres")
}

pub async fn build_state(config: Arc<AppConfig>) -> Arc<AppState> {
    let db_pool = create_pool(&config).await;
    info!("Connected to PostgreSQL database");

    let stripe_client = stripe::Client::new(config.stripe_api_key.clone());
    info!("Stripe API key loaded");

    let idempotency_service = IdempotencyService::new(
        db_pool.clone(),
        IdempotencyConfig::default(),
    );
    info!("Idempotency service initialized");

    if config.alert_webhook_url.is_some() {
        info!("Alert webhook configured — scheduler failures will be reported");
    }
    info!(app_base_url = %config.app_base_url, "APP_BASE_URL configured");
    info!(ttl_hours = config.payment_share_ttl_hours, "Payment share TTL configured");

    Arc::new(AppState::new(
        db_pool,
        stripe_client,
        idempotency_service,
        config,
    ))
}

pub fn start_background_jobs(app_state: Arc<AppState>) {
    let scheduler_state = Arc::clone(&app_state);
    tokio::spawn(async move {
        crate::services::payment_scheduler::run(scheduler_state).await;
    });
    info!("Payment scheduler started (runs daily at 09:00 UTC)");

    let cleanup_pool = app_state.db_pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));

        loop {
            interval.tick().await;

            match sqlx::query("SELECT cleanup_expired_idempotency_keys()")
                .execute(&cleanup_pool)
                .await
            {
                Ok(result) => {
                    let rows = result.rows_affected();
                    if rows > 0 {
                        tracing::info!(deleted_records = rows, "Idempotency cleanup completed");
                    }
                }
                Err(e) => tracing::error!(error = %e, "Idempotency cleanup failed"),
            }
        }
    });
    info!("Idempotency cleanup job started (runs hourly)");
}
