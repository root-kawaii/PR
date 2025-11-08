// src/main.rs
use std::env;
use std::sync::Arc;
use dotenv::dotenv;
use sqlx::PgPool;
use axum::{
    routing::{get, post, put, delete},
    Router,
};
use tower_http::cors::{CorsLayer, Any};

// Declare your modules
mod models;
mod controllers;
mod persistences;
mod utils;

// Import specific items from your modules
use crate::models::AppState;
use crate::controllers::payment_controller::{
    get_all_payments,
    get_payment,
    post_payment,
    delete_payment,
};
use crate::controllers::event_controller::{
    get_all_events as get_all_events_old,
    get_events as get_events_old,
    post_events,
    delete_events,
};
use crate::controllers::event_new_controller::{
    get_all_events,
    get_event,
    create_event,
    update_event,
    delete_event,
};
use crate::controllers::auth_controller::{
    register,
    login,
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
};

pub fn create_router(app_state: Arc<AppState>) -> Router {
    // Configure CORS to allow requests from React Native
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Auth routes
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
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
        // Payment routes
        .route("/payments", get(get_all_payments).post(post_payment))
        .route("/payments/:id", get(get_payment).delete(delete_payment))
        .with_state(app_state)
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
    
    // Load Stripe API key
    let stripe_api_key = env::var("STRIPE_SECRET_KEY")
        .or_else(|_| env::var("STRIPE_API_KEY"))
        .expect("STRIPE_SECRET_KEY or STRIPE_API_KEY must be set in .env");

    let stripe_client = stripe::Client::new(stripe_api_key);
    println!("✅ Stripe API Key loaded");

    // Load JWT secret
    let jwt_secret = env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-secret-key-change-this-in-production".to_string());
    println!("✅ JWT Secret loaded");

    // Create database pool
    let db_pool = create_pool().await;
    println!("✅ Connected to PostgreSQL database");

    // Create application state with db_pool, stripe_client, and jwt_secret
    let app_state = Arc::new(AppState {
        db_pool,
        stripe_client,
        jwt_secret,
    });
    
    // Create router with AppState
    let app = create_router(app_state);

    // Start server - bind to 0.0.0.0 to accept connections from network
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    println!("🚀 Server running on http://0.0.0.0:3000");
    println!("   Local: http://127.0.0.1:3000");
    println!("   Network: http://172.20.10.5:3000");
    println!("📝 Available endpoints:");
    println!("   POST           /auth/register");
    println!("   POST           /auth/login");
    println!("   GET/POST       /events");
    println!("   GET/PUT/DELETE /events/:id");
    println!("   GET/POST       /genres");
    println!("   GET/PUT/DELETE /genres/:id");
    println!("   GET/POST       /clubs");
    println!("   GET/PUT/DELETE /clubs/:id");
    println!("   GET/POST       /tickets");
    println!("   GET/PUT/DELETE /tickets/:id");
    println!("   GET            /tickets/code/:code");
    println!("   GET            /tickets/user/:user_id");
    println!("   GET/POST       /tables");
    println!("   GET/PUT/DELETE /tables/:id");
    println!("   GET            /tables/event/:event_id");
    println!("   GET            /tables/event/:event_id/available");
    println!("   GET            /reservations");
    println!("   GET/PUT/DELETE /reservations/:id");
    println!("   GET            /reservations/code/:code");
    println!("   GET/POST       /reservations/user/:user_id");
    println!("   GET            /reservations/table/:table_id");
    println!("   POST           /reservations/:reservation_id/payments");
    println!("   GET/POST       /reservations/:reservation_id/tickets");
    println!("   GET/POST       /payments");
    println!("   GET/DELETE     /payments/:id");
    
    axum::serve(listener, app).await.unwrap();
}