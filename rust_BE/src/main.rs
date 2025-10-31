// src/main.rs

// Declare your modules (tells Rust these files exist)
mod models;
mod controllers;
mod persistences;
// Import specific items from your modules
use crate::models::{EventEntity, EventRequest, AppState}; // Correct!

use axum::{
    routing::{get, post, put, delete},
    Router,
};

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
use sqlx::PgPool;

pub fn create_router(pool: AppState) -> Router {
    Router::new()
        .route("/events", get(get_all_events).post(post_events))
        .route(
            "/events/:id",
            get(get_events).delete(delete_events),
        )
        .route("/payments", get(get_all_payments).post(post_payment))
        .route(
            "/payments/:id",
            get(get_payment).delete(delete_payment),
        )
        .with_state(pool)
}

pub async fn create_pool() -> PgPool {
    let database_url = "postgresql://postgres:password@localhost:5432/events";
    PgPool::connect(database_url)
        .await
        .expect("Failed to connect to Postgres")
}

#[tokio::main]
async fn main() {

    let pool = create_pool().await;
    println!("Connected to PostgreSQL database");
    
    let app = create_router(pool);
    
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();
    
    println!("🚀 Server running on http://127.0.0.1:3000");
    
    axum::serve(listener, app).await.unwrap();
}