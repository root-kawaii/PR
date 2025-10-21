// src/main.rs

// Declare your modules (tells Rust these files exist)
mod models;      // Looks for src/models.rs
mod handlers;    // Looks for src/handlers.rs

// Import specific items from your modules
use models::{Event, CreateEvent, UpdateEvent, AppState};

// src/routes.rs

use axum::{
    routing::{get, post, put, delete},
    Router,
};

use crate::handlers::{
    get_all_events, 
    get_event, 
    create_event, 
    update_event, 
    delete_event
};
use sqlx::PgPool;

pub fn create_router(pool: AppState) -> Router {
    Router::new()
        .route("/events", get(get_all_events).post(create_event))
        .route(
            "/events/:id",
            get(get_event).put(update_event).delete(delete_event),
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