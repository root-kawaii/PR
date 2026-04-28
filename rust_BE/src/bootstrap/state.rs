use std::sync::Arc;

use sqlx::PgPool;

use crate::bootstrap::config::AppConfig;
use crate::idempotency::IdempotencyService;

pub struct AppState {
    pub db_pool: PgPool,
    pub read_db_pool: PgPool,
    pub stripe_client: stripe::Client,
    pub jwt_secret: String,
    pub idempotency_service: IdempotencyService,
    pub stripe_webhook_secret: String,
    pub alert_webhook_url: Option<String>,
    pub payment_share_ttl_hours: i64,
    pub http_client: reqwest::Client,
    pub config: Arc<AppConfig>,
}

impl AppState {
    pub fn new(
        db_pool: PgPool,
        read_db_pool: PgPool,
        stripe_client: stripe::Client,
        idempotency_service: IdempotencyService,
        config: Arc<AppConfig>,
    ) -> Self {
        Self {
            db_pool,
            read_db_pool,
            stripe_client,
            jwt_secret: config.auth.jwt_secret.clone(),
            idempotency_service,
            stripe_webhook_secret: config.stripe.webhook_secret.clone(),
            alert_webhook_url: config.notifications.alert_webhook_url.clone(),
            payment_share_ttl_hours: config.payment_share_ttl_hours,
            http_client: reqwest::Client::new(),
            config,
        }
    }
}
