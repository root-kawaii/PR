// src/main.rs
use std::env;
use std::sync::Arc;
use dotenv::dotenv;
use sqlx::PgPool;
use axum::{
    routing::{get, post},
    Router,
    middleware::from_fn,
    extract::State,
    http::{HeaderValue, Method, header},
    Json,
};
use tower_http::cors::CorsLayer;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tracing::{info, error};

// Declare your modules
mod models;
mod controllers;
mod persistences;
mod utils;
mod services;
mod idempotency;
mod logging;
mod middleware;

// Import specific items from your modules
use crate::models::AppState;
use crate::idempotency::{IdempotencyService, IdempotencyConfig};
use crate::controllers::payment_controller::{
    get_all_payments,
    get_payment,
    post_payment,
    post_authorized_payment,
    capture_payment,
    cancel_payment,
    delete_payment,
};
use crate::controllers::event_controller::{
    get_all_events,
    get_event,
    create_event,
    update_event,
    delete_event,
};
use crate::controllers::auth_controller::{
    register,
    login,
    send_sms_verification,
    verify_sms_code,
    register_push_token,
};
use crate::controllers::genre_controller::{
    get_all_genres,
    get_genre,
    create_genre,
    update_genre,
    delete_genre,
};
use crate::controllers::club_controller::{
    get_all_clubs,
    get_club,
    create_club,
    update_club,
    delete_club,
};
use crate::controllers::ticket_controller::{
    get_all_tickets,
    get_user_tickets_with_events,
    get_ticket,
    get_ticket_by_code,
    create_ticket,
    update_ticket,
    delete_ticket,
};
use crate::controllers::table_controller::{
    get_all_tables,
    get_tables_by_event,
    get_available_tables_by_event,
    get_table,
    create_table,
    update_table,
    delete_table,
    get_all_reservations,
    get_user_reservations_with_details,
    get_reservations_by_table,
    get_reservation,
    get_reservation_by_code,
    create_reservation,
    update_reservation,
    delete_reservation,
    add_payment_to_reservation,
    link_ticket_to_reservation,
    get_tickets_for_reservation,
    create_payment_intent,
    create_reservation_with_payment,
    get_payment_link_preview,
    verify_payment_link,
    create_payment_link_checkout,
    add_free_guest_to_reservation,
    get_reservation_payment_status,
    guest_payment_page,
    payment_success_page,
    payment_cancel_page,
};
use crate::controllers::club_owner_controller::{
    register_club_owner,
    login_club_owner,
    get_my_club,
    update_my_club,
    get_my_club_events,
    create_club_event,
    get_my_club_tables,
    create_club_table,
    get_my_club_images,
    add_my_club_image,
    delete_my_club_image,
    get_table_images_handler,
    add_table_image_handler,
    delete_table_image_handler,
    get_event_reservations_handler,
    create_manual_reservation_handler,
    update_reservation_status_handler,
    scan_code_handler,
    checkin_handler,
    get_owner_stats_handler,
};
use crate::controllers::webhook_controller::handle_stripe_webhook;
use crate::controllers::area_controller::{
    list_areas_by_club,
    list_my_areas,
    create_area,
    update_area,
    delete_area,
    assign_table_area,
};

async fn health_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| axum::http::StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

pub fn create_router(app_state: Arc<AppState>) -> Router {
    // Configure CORS — restrict to known origins only.
    // React Native apps do not send Origin headers so this does not affect mobile clients.
    let app_base_url = env::var("APP_BASE_URL").unwrap_or_default();
    let mut allowed_origins: Vec<HeaderValue> = vec![
        "http://localhost:3000".parse().unwrap(),
        "http://localhost:8081".parse().unwrap(),
        "https://pierre-two-backend.fly.dev".parse().unwrap(),
    ];
    if let Ok(origin) = app_base_url.parse::<HeaderValue>() {
        allowed_origins.push(origin);
    }
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    // Configure request ID middleware
    let (set_request_id, propagate_request_id) = crate::middleware::request_id::request_id_layer();

    // Rate limiter for auth endpoints: 10 requests per minute per IP
    let auth_governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(6)   // replenish 1 token every 6s = 10 req/min
            .burst_size(10)
            .finish()
            .unwrap(),
    );

    let auth_routes = Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/send-sms-verification", post(send_sms_verification))
        .route("/auth/verify-sms-code", post(verify_sms_code))
        .route("/auth/push-token", post(register_push_token))
        .route("/auth/club-owner/register", post(register_club_owner))
        .route("/auth/club-owner/login", post(login_club_owner))
        .layer(GovernorLayer { config: auth_governor_conf });

    Router::new()
        // Health check (unauthenticated, for load balancer probes)
        .route("/health", get(health_check))
        // Auth routes with rate limiting
        .merge(auth_routes)
        // Event routes — reads are public, writes require club owner JWT
        .route("/events", get(get_all_events).post(create_event))
        .route("/events/:id", get(get_event).put(update_event).delete(delete_event))
        // Genre routes — reads are public, writes require club owner JWT
        .route("/genres", get(get_all_genres).post(create_genre))
        .route("/genres/:id", get(get_genre).put(update_genre).delete(delete_genre))
        // Club routes — reads are public, writes require club owner JWT
        .route("/clubs", get(get_all_clubs).post(create_club))
        .route("/clubs/:id", get(get_club).put(update_club).delete(delete_club))
        // Ticket routes — reads are public, writes require club owner JWT
        .route("/tickets", get(get_all_tickets).post(create_ticket))
        .route("/tickets/:id", get(get_ticket).put(update_ticket).delete(delete_ticket))
        .route("/tickets/code/:code", get(get_ticket_by_code))
        .route("/tickets/user/:user_id", get(get_user_tickets_with_events))
        // Table routes — reads are public, writes require club owner JWT
        .route("/tables", get(get_all_tables).post(create_table))
        .route("/tables/:id", get(get_table).put(update_table).delete(delete_table))
        .route("/tables/event/:event_id", get(get_tables_by_event))
        .route("/tables/event/:event_id/available", get(get_available_tables_by_event))
        // Table reservation routes — require authenticated user JWT
        .route("/reservations", get(get_all_reservations))
        .route("/reservations/:id", get(get_reservation).put(update_reservation).delete(delete_reservation))
        .route("/reservations/code/:code", get(get_reservation_by_code))
        .route("/reservations/user/:user_id", get(get_user_reservations_with_details).post(create_reservation))
        .route("/reservations/table/:table_id", get(get_reservations_by_table))
        .route("/reservations/:reservation_id/payments", post(add_payment_to_reservation))
        .route("/reservations/:reservation_id/tickets", post(link_ticket_to_reservation).get(get_tickets_for_reservation))
        .route("/reservations/create-payment-intent", post(create_payment_intent))
        .route("/reservations/create-with-payment", post(create_reservation_with_payment))
        .route("/reservations/:reservation_id/add-guest", post(add_free_guest_to_reservation))
        .route("/reservations/:reservation_id/payment-status", get(get_reservation_payment_status))
        // Guest payment web pages (no auth — public, served as HTML)
        .route("/pay/:token", get(guest_payment_page))
        .route("/payment/success", get(payment_success_page))
        .route("/payment/cancel/:token", get(payment_cancel_page))
        // Payment link routes (for split payment guests — no auth, token-based)
        .route("/payment-links/:token", get(get_payment_link_preview))
        .route("/payment-links/:token/verify", post(verify_payment_link))
        .route("/payment-links/:token/checkout", post(create_payment_link_checkout))
        // Club owner scoped routes (JWT protected, role = club_owner)
        .route("/owner/club", get(get_my_club).put(update_my_club))
        .route("/owner/club/images", get(get_my_club_images).post(add_my_club_image))
        .route("/owner/club/images/:id", axum::routing::delete(delete_my_club_image))
        .route("/owner/events", get(get_my_club_events).post(create_club_event))
        .route("/owner/events/:event_id/tables", get(get_my_club_tables).post(create_club_table))
        .route("/owner/events/:event_id/reservations", get(get_event_reservations_handler))
        .route("/owner/events/:event_id/reservations/manual", post(create_manual_reservation_handler))
        .route("/owner/reservations/:id/status", axum::routing::patch(update_reservation_status_handler))
        .route("/owner/tables/:id/images", get(get_table_images_handler).post(add_table_image_handler))
        .route("/owner/table-images/:id", axum::routing::delete(delete_table_image_handler))
        .route("/owner/scan/:code", get(scan_code_handler))
        .route("/owner/checkin/:code", post(checkin_handler))
        .route("/owner/stats", get(get_owner_stats_handler))
        // Payment routes (require JWT)
        .route("/payments", get(get_all_payments).post(post_payment))
        .route("/payments/authorize", post(post_authorized_payment))
        .route("/payments/:id", get(get_payment).delete(delete_payment))
        .route("/payments/:id/capture", post(capture_payment))
        .route("/payments/:id/cancel", post(cancel_payment))
        // Area routes (public list + owner CRUD)
        .route("/clubs/:club_id/areas", get(list_areas_by_club))
        .route("/owner/areas", get(list_my_areas).post(create_area))
        .route("/owner/areas/:area_id", axum::routing::patch(update_area).delete(delete_area))
        .route("/owner/tables/:table_id/area", axum::routing::patch(assign_table_area))
        // Stripe webhook (no JWT auth — Stripe verifies via HMAC signature)
        .route("/stripe/webhooks", post(handle_stripe_webhook))
        .with_state(app_state)
        .layer(from_fn(crate::middleware::request_id::trace_request))
        .layer(set_request_id)
        .layer(propagate_request_id)
        .layer(cors)
}

pub async fn create_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/events".to_string());
    
    PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to Postgres")
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    // Initialize logging first - MUST keep guard alive for entire program
    let _log_guard = crate::logging::init_logging();
    info!("Logging system initialized");

    // Load Stripe API key
    let stripe_api_key = env::var("STRIPE_SECRET_KEY")
        .or_else(|_| env::var("STRIPE_API_KEY"))
        .expect("STRIPE_SECRET_KEY or STRIPE_API_KEY must be set in .env");

    let stripe_client = stripe::Client::new(stripe_api_key);
    info!("Stripe API Key loaded");

    // Load JWT secret — must be set and at least 32 chars
    let jwt_secret = env::var("JWT_SECRET")
        .expect("JWT_SECRET env var must be set");
    if jwt_secret.len() < 32 {
        panic!("JWT_SECRET must be at least 32 characters long");
    }
    info!("JWT Secret loaded");

    // Load Stripe webhook secret — required, no fallback
    let stripe_webhook_secret = env::var("STRIPE_WEBHOOK_SECRET")
        .expect("STRIPE_WEBHOOK_SECRET env var must be set — webhook signature verification cannot be disabled");
    if stripe_webhook_secret.is_empty() {
        panic!("STRIPE_WEBHOOK_SECRET must not be empty");
    }

    // Validate APP_BASE_URL is set (required for payment link redirects)
    let app_base_url = env::var("APP_BASE_URL")
        .expect("APP_BASE_URL env var must be set (used for Stripe Checkout redirect URLs)");
    if app_base_url.is_empty() {
        panic!("APP_BASE_URL must not be empty");
    }
    info!(app_base_url = %app_base_url, "APP_BASE_URL configured");

    // Create database pool
    let db_pool = create_pool().await;
    info!("Connected to PostgreSQL database");

    // Initialize idempotency service
    let idempotency_config = IdempotencyConfig::default();
    let idempotency_service = IdempotencyService::new(db_pool.clone(), idempotency_config);
    info!("Idempotency service initialized");

    // Load optional alert webhook URL (Discord or Slack)
    let alert_webhook_url = env::var("ALERT_WEBHOOK_URL").ok().filter(|s| !s.is_empty());
    if alert_webhook_url.is_some() {
        info!("Alert webhook configured — scheduler failures will be reported");
    }

    // Payment share TTL (how long guests have to pay before their share expires)
    let payment_share_ttl_hours: i64 = env::var("PAYMENT_SHARE_TTL_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(48);
    info!(ttl_hours = payment_share_ttl_hours, "Payment share TTL configured");

    // Create application state with db_pool, stripe_client, jwt_secret, and idempotency_service
    let app_state = Arc::new(AppState {
        db_pool: db_pool.clone(),
        stripe_client,
        jwt_secret,
        idempotency_service,
        stripe_webhook_secret,
        alert_webhook_url,
        payment_share_ttl_hours,
    });

    // Spawn daily payment scheduler (capture day-before, re-authorize every 6 days)
    let scheduler_state = Arc::clone(&app_state);
    tokio::spawn(async move {
        crate::services::payment_scheduler::run(scheduler_state).await;
    });
    info!("Payment scheduler started (runs daily at 09:00 UTC)");

    // Spawn periodic cleanup job for expired idempotency records
    let cleanup_pool = db_pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // Every hour

        loop {
            interval.tick().await;

            match sqlx::query("SELECT cleanup_expired_idempotency_keys()")
                .execute(&cleanup_pool)
                .await
            {
                Ok(result) => {
                    let rows = result.rows_affected();
                    if rows > 0 {
                        info!(deleted_records = rows, "Idempotency cleanup completed");
                    }
                }
                Err(e) => error!(error = %e, "Idempotency cleanup failed"),
            }
        }
    });
    info!("Idempotency cleanup job started (runs hourly)");

    // Create router with AppState
    let app = create_router(app_state);

    // Start server - bind to 0.0.0.0 to accept connections from network
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .unwrap();

    info!("Server starting on http://0.0.0.0:3000");
    info!("  Local: http://127.0.0.1:3000");
    info!("  Network: http://172.20.10.5:3000");

    axum::serve(listener, app).await.unwrap();
}