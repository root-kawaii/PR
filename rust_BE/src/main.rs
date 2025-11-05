// src/main.rs
use std::env;
use std::sync::Arc;
use dotenv::dotenv;
use sqlx::PgPool;
use axum::{
    routing::{get, post, delete},
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
    get_all_events,
    get_events,
    post_events,
    delete_events,
};
use crate::controllers::auth_controller::{
    register,
    login,
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
        // Event routes
        .route("/events", get(get_all_events).post(post_events))
        .route("/events/:id", get(get_events).delete(delete_events))
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
    println!("   POST        /auth/register");
    println!("   POST        /auth/login");
    println!("   GET/POST    /events");
    println!("   GET/DELETE  /events/:id");
    println!("   GET/POST    /payments");
    println!("   GET/DELETE  /payments/:id");
    
    axum::serve(listener, app).await.unwrap();
}