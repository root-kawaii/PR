// src/main.rs

// Declare your modules (tells Rust these files exist)
mod models;
mod controllers;
mod services;
// Import specific items from your modules
use crate::models::{EventEntity, EventRequest, AppState}; // Correct!
use crate::services::event_service::{
    load_all_events_service,
    load_event_service,
    create_event_service,
    erase_event_service,
};
// src/routes.rs

use axum::{
    routing::{get, post, put, delete},
    Router,
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