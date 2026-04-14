use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub stripe_api_key: String,
    pub jwt_secret: String,
    pub stripe_webhook_secret: String,
    pub app_base_url: String,
    pub alert_webhook_url: Option<String>,
    pub payment_share_ttl_hours: i64,
    pub port: u16,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/events".to_string());

        let stripe_api_key = env::var("STRIPE_SECRET_KEY")
            .or_else(|_| env::var("STRIPE_API_KEY"))
            .expect("STRIPE_SECRET_KEY or STRIPE_API_KEY must be set in .env");

        let jwt_secret = env::var("JWT_SECRET")
            .expect("JWT_SECRET env var must be set");
        if jwt_secret.len() < 32 {
            panic!("JWT_SECRET must be at least 32 characters long");
        }

        let stripe_webhook_secret = env::var("STRIPE_WEBHOOK_SECRET")
            .expect("STRIPE_WEBHOOK_SECRET env var must be set — webhook signature verification cannot be disabled");
        if stripe_webhook_secret.is_empty() {
            panic!("STRIPE_WEBHOOK_SECRET must not be empty");
        }

        let app_base_url = env::var("APP_BASE_URL")
            .expect("APP_BASE_URL env var must be set (used for Stripe Checkout redirect URLs)");
        if app_base_url.is_empty() {
            panic!("APP_BASE_URL must not be empty");
        }

        let alert_webhook_url = env::var("ALERT_WEBHOOK_URL").ok().filter(|s| !s.is_empty());
        let payment_share_ttl_hours = env::var("PAYMENT_SHARE_TTL_HOURS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(48);
        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3000);

        Self {
            database_url,
            stripe_api_key,
            jwt_secret,
            stripe_webhook_secret,
            app_base_url,
            alert_webhook_url,
            payment_share_ttl_hours,
            port,
        }
    }
}
