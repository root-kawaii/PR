use std::env;

#[derive(Clone, Debug)]
pub struct DatabaseConfig {
    pub url: String,
    pub read_url: Option<String>,
    pub public_cache_ttl_seconds: u64,
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub jwt_secret: String,
}

#[derive(Clone, Debug)]
pub struct StripeConfig {
    pub api_key: String,
    pub publishable_key: String,
    pub webhook_secret: String,
}

#[derive(Clone, Debug)]
pub struct NotificationsConfig {
    pub alert_webhook_url: Option<String>,
    pub twilio_account_sid: Option<String>,
    pub twilio_auth_token: Option<String>,
    pub twilio_verify_service_sid: Option<String>,
    pub twilio_phone_number: Option<String>,
    pub app_review_bypass_enabled: bool,
    pub app_review_bypass_code: Option<String>,
    pub app_review_bypass_phone_numbers: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct AnalyticsConfig {
    pub outbox_poll_interval_seconds: u64,
    pub outbox_batch_size: i64,
    pub posthog_api_key: Option<String>,
    pub posthog_host: String,
    pub environment: String,
    pub service_name: String,
}

#[derive(Clone, Debug)]
pub struct FeatureFlagsConfig {
    pub provider: String,
    pub bootstrap_flags_from_env: bool,
}

#[derive(Clone, Debug)]
pub struct JobsConfig {
    pub payment_frequent_interval_seconds: u64,
    pub idempotency_cleanup_interval_seconds: u64,
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub database: DatabaseConfig,
    pub auth: AuthConfig,
    pub stripe: StripeConfig,
    pub notifications: NotificationsConfig,
    pub analytics: AnalyticsConfig,
    pub feature_flags: FeatureFlagsConfig,
    pub jobs: JobsConfig,
    pub app_base_url: String,
    pub owner_app_base_url: String,
    pub payment_share_ttl_hours: i64,
    pub port: u16,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/events".to_string());
        let read_database_url = env::var("DATABASE_READ_URL").ok().filter(|s| !s.is_empty());
        let public_cache_ttl_seconds = env::var("PUBLIC_CACHE_TTL_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let stripe_api_key = env::var("STRIPE_SECRET_KEY")
            .or_else(|_| env::var("STRIPE_API_KEY"))
            .expect("STRIPE_SECRET_KEY or STRIPE_API_KEY must be set in .env");
        let stripe_publishable_key = env::var("STRIPE_PUBLISHABLE_KEY")
            .or_else(|_| env::var("EXPO_PUBLIC_STRIPE_KEY"))
            .expect("STRIPE_PUBLISHABLE_KEY or EXPO_PUBLIC_STRIPE_KEY must be set in .env");
        validate_stripe_key_pair(&stripe_api_key, &stripe_publishable_key);

        let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET env var must be set");
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
        let owner_app_base_url = env::var("OWNER_APP_BASE_URL")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| app_base_url.clone());

        let alert_webhook_url = env::var("ALERT_WEBHOOK_URL").ok().filter(|s| !s.is_empty());
        let twilio_account_sid = env::var("TWILIO_ACCOUNT_SID")
            .ok()
            .filter(|s| !s.is_empty());
        let twilio_auth_token = env::var("TWILIO_AUTH_TOKEN").ok().filter(|s| !s.is_empty());
        let twilio_verify_service_sid = env::var("TWILIO_VERIFY_SERVICE_SID")
            .ok()
            .filter(|s| !s.is_empty());
        let twilio_phone_number = env::var("TWILIO_PHONE_NUMBER")
            .ok()
            .filter(|s| !s.is_empty());
        let app_review_bypass_enabled = env::var("APP_REVIEW_BYPASS_ENABLED")
            .ok()
            .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(false);
        let app_review_bypass_code = env::var("APP_REVIEW_BYPASS_CODE")
            .ok()
            .filter(|s| !s.is_empty());
        let app_review_bypass_phone_numbers = env::var("APP_REVIEW_BYPASS_PHONE_NUMBERS")
            .ok()
            .map(|value| {
                value
                    .split(',')
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default();
        let payment_share_ttl_hours = env::var("PAYMENT_SHARE_TTL_HOURS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(48);
        let outbox_poll_interval_seconds = env::var("OUTBOX_POLL_INTERVAL_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5);
        let outbox_batch_size = env::var("OUTBOX_BATCH_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(50);
        let posthog_api_key = env::var("POSTHOG_API_KEY").ok().filter(|s| !s.is_empty());
        let posthog_host =
            env::var("POSTHOG_HOST").unwrap_or_else(|_| "https://eu.i.posthog.com".to_string());
        let analytics_environment = env::var("APP_ENV")
            .or_else(|_| env::var("RUST_ENV"))
            .unwrap_or_else(|_| "development".to_string());
        let analytics_service_name =
            env::var("SERVICE_NAME").unwrap_or_else(|_| "rust_BE".to_string());
        let feature_flag_provider =
            env::var("FEATURE_FLAG_PROVIDER").unwrap_or_else(|_| "posthog".to_string());
        let bootstrap_flags_from_env = env::var("FEATURE_FLAGS_BOOTSTRAP_FROM_ENV")
            .ok()
            .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(false);
        let payment_frequent_interval_seconds = env::var("PAYMENT_FREQUENT_INTERVAL_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30 * 60);
        let idempotency_cleanup_interval_seconds = env::var("IDEMPOTENCY_CLEANUP_INTERVAL_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3600);
        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3000);

        Self {
            database: DatabaseConfig {
                url: database_url,
                read_url: read_database_url,
                public_cache_ttl_seconds,
            },
            auth: AuthConfig { jwt_secret },
            stripe: StripeConfig {
                api_key: stripe_api_key,
                publishable_key: stripe_publishable_key,
                webhook_secret: stripe_webhook_secret,
            },
            notifications: NotificationsConfig {
                alert_webhook_url,
                twilio_account_sid,
                twilio_auth_token,
                twilio_verify_service_sid,
                twilio_phone_number,
                app_review_bypass_enabled,
                app_review_bypass_code,
                app_review_bypass_phone_numbers,
            },
            analytics: AnalyticsConfig {
                outbox_poll_interval_seconds,
                outbox_batch_size,
                posthog_api_key,
                posthog_host,
                environment: analytics_environment,
                service_name: analytics_service_name,
            },
            feature_flags: FeatureFlagsConfig {
                provider: feature_flag_provider,
                bootstrap_flags_from_env,
            },
            jobs: JobsConfig {
                payment_frequent_interval_seconds,
                idempotency_cleanup_interval_seconds,
            },
            app_base_url,
            owner_app_base_url,
            payment_share_ttl_hours,
            port,
        }
    }
}

fn validate_stripe_key_pair(secret_key: &str, publishable_key: &str) {
    let secret_mode = stripe_key_mode(secret_key, "sk_")
        .expect("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_");
    let publishable_mode = stripe_key_mode(publishable_key, "pk_")
        .expect("STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_");

    if secret_mode != publishable_mode {
        panic!(
            "Stripe key mode mismatch: STRIPE_SECRET_KEY is {secret_mode}, but STRIPE_PUBLISHABLE_KEY is {publishable_mode}"
        );
    }
}

fn stripe_key_mode<'a>(key: &'a str, expected_prefix: &str) -> Option<&'a str> {
    key.strip_prefix(expected_prefix)
        .and_then(|rest| rest.split_once('_'))
        .map(|(mode, _)| mode)
        .filter(|mode| matches!(*mode, "test" | "live"))
}
