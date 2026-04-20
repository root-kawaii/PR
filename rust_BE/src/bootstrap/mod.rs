pub mod config;
pub mod state;

use std::sync::Arc;

use sqlx::PgPool;
use tracing::info;

use crate::bootstrap::config::AppConfig;
use crate::bootstrap::state::AppState;
use crate::idempotency::{IdempotencyConfig, IdempotencyService};

pub async fn create_pool(config: &AppConfig) -> PgPool {
    PgPool::connect(&config.database.url)
        .await
        .expect("Failed to connect to Postgres")
}

pub async fn create_read_pool(config: &AppConfig, write_pool: &PgPool) -> PgPool {
    match &config.database.read_url {
        Some(read_url) => {
            let pool = PgPool::connect(read_url)
                .await
                .expect("Failed to connect to read Postgres replica");
            info!("Connected to PostgreSQL read pool");
            pool
        }
        None => {
            info!("DATABASE_READ_URL not configured, using primary pool for reads");
            write_pool.clone()
        }
    }
}

pub async fn build_state(config: Arc<AppConfig>) -> Arc<AppState> {
    let db_pool = create_pool(&config).await;
    info!("Connected to PostgreSQL database");
    let read_db_pool = create_read_pool(&config, &db_pool).await;

    let stripe_client = stripe::Client::new(config.stripe.api_key.clone());
    info!("Stripe API key loaded");

    let idempotency_service =
        IdempotencyService::new(db_pool.clone(), IdempotencyConfig::default());
    info!("Idempotency service initialized");

    if config.notifications.alert_webhook_url.is_some() {
        info!("Alert webhook configured — scheduler failures will be reported");
    }
    info!(app_base_url = %config.app_base_url, "APP_BASE_URL configured");
    info!(
        ttl_hours = config.payment_share_ttl_hours,
        "Payment share TTL configured"
    );
    info!(
        cache_ttl_seconds = config.database.public_cache_ttl_seconds,
        feature_flag_provider = %config.feature_flags.provider,
        outbox_batch_size = config.analytics.outbox_batch_size,
        "Infrastructure config loaded"
    );

    Arc::new(AppState::new(
        db_pool,
        read_db_pool,
        stripe_client,
        idempotency_service,
        config,
    ))
}

pub fn start_background_jobs(app_state: Arc<AppState>) {
    crate::jobs::start_background_jobs(app_state);
}
