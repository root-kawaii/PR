// src/main.rs
use std::env;
use std::sync::Arc;
use dotenv::dotenv;
use sqlx::PgPool;
use axum::{
    routing::{get, post},
    Router,
    middleware::from_fn,
};
use tower_http::cors::{CorsLayer, Any};
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

pub fn create_router(app_state: Arc<AppState>) -> Router {
    // Configure CORS to allow requests from React Native
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Configure request ID middleware
    let (set_request_id, propagate_request_id) = crate::middleware::request_id::request_id_layer();

    Router::new()
        // Auth routes
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/send-sms-verification", post(send_sms_verification))
        .route("/auth/verify-sms-code", post(verify_sms_code))
        // Club owner auth routes
        .route("/auth/club-owner/register", post(register_club_owner))
        .route("/auth/club-owner/login", post(login_club_owner))
        // Event routes (new schema)
        .route("/events", get(get_all_events).post(create_event))
        .route("/events/:id", get(get_event).put(update_event).delete(delete_event))
        // Genre routes
        .route("/genres", get(get_all_genres).post(create_genre))
        .route("/genres/:id", get(get_genre).put(update_genre).delete(delete_genre))
        // Club routes
        .route("/clubs", get(get_all_clubs).post(create_club))
        .route("/clubs/:id", get(get_club).put(update_club).delete(delete_club))
        // Ticket routes
        .route("/tickets", get(get_all_tickets).post(create_ticket))
        .route("/tickets/:id", get(get_ticket).put(update_ticket).delete(delete_ticket))
        .route("/tickets/code/:code", get(get_ticket_by_code))
        .route("/tickets/user/:user_id", get(get_user_tickets_with_events))
        // Table routes
        .route("/tables", get(get_all_tables).post(create_table))
        .route("/tables/:id", get(get_table).put(update_table).delete(delete_table))
        .route("/tables/event/:event_id", get(get_tables_by_event))
        .route("/tables/event/:event_id/available", get(get_available_tables_by_event))
        // Table reservation routes
        .route("/reservations", get(get_all_reservations))
        .route("/reservations/:id", get(get_reservation).put(update_reservation).delete(delete_reservation))
        .route("/reservations/code/:code", get(get_reservation_by_code))
        .route("/reservations/user/:user_id", get(get_user_reservations_with_details).post(create_reservation))
        .route("/reservations/table/:table_id", get(get_reservations_by_table))
        .route("/reservations/:reservation_id/payments", post(add_payment_to_reservation))
        .route("/reservations/:reservation_id/tickets", post(link_ticket_to_reservation).get(get_tickets_for_reservation))
        .route("/reservations/create-payment-intent", post(create_payment_intent))
        .route("/reservations/create-with-payment", post(create_reservation_with_payment))
        // Club owner scoped routes (JWT protected)
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
        // Payment routes
        .route("/payments", get(get_all_payments).post(post_payment))
        .route("/payments/authorize", post(post_authorized_payment))
        .route("/payments/:id", get(get_payment).delete(delete_payment))
        .route("/payments/:id/capture", post(capture_payment))
        .route("/payments/:id/cancel", post(cancel_payment))
        // Stripe webhook (no JWT auth — Stripe verifies via signature)
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

    // Load JWT secret
    let jwt_secret = env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-secret-key-change-this-in-production".to_string());
    info!("JWT Secret loaded");

    // Load Stripe webhook secret
    let stripe_webhook_secret = env::var("STRIPE_WEBHOOK_SECRET")
        .unwrap_or_else(|_| {
            tracing::warn!("STRIPE_WEBHOOK_SECRET not set — webhook signature verification disabled");
            String::new()
        });

    // Create database pool
    let db_pool = create_pool().await;
    info!("Connected to PostgreSQL database");

    // Initialize idempotency service
    let idempotency_config = IdempotencyConfig::default();
    let idempotency_service = IdempotencyService::new(db_pool.clone(), idempotency_config);
    info!("Idempotency service initialized");

    // Create application state with db_pool, stripe_client, jwt_secret, and idempotency_service
    let app_state = Arc::new(AppState {
        db_pool: db_pool.clone(),
        stripe_client,
        jwt_secret,
        idempotency_service,
        stripe_webhook_secret,
    });

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