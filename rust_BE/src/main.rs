use dotenv::dotenv;
use std::sync::Arc;
use tracing::info;

mod models;
mod api;
mod application;
mod bootstrap;
mod controllers;
mod infrastructure;
mod utils;
mod services;
mod idempotency;
mod middleware;

#[tokio::main]
async fn main() {
    dotenv().ok();

    let _log_guard = crate::infrastructure::logging::init_logging();
    info!("Logging system initialized");

    let config = Arc::new(crate::bootstrap::config::AppConfig::from_env());
    let app_state = crate::bootstrap::build_state(Arc::clone(&config)).await;
    crate::bootstrap::start_background_jobs(Arc::clone(&app_state));

    let app = crate::api::build_router(Arc::clone(&app_state));

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port))
        .await
        .unwrap();

    info!(port = config.port, "Server starting");
    info!(local = %format!("http://127.0.0.1:{}", config.port), "Local address");

    axum::serve(listener, app).await.unwrap();
}
