use dotenv::dotenv;
use std::fs;
use std::path::PathBuf;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::info;

mod api;
mod application;
mod bootstrap;
mod controllers;
mod idempotency;
mod infrastructure;
mod jobs;
mod middleware;
mod models;
mod services;
mod utils;

#[tokio::main]
async fn main() {
    let manifest_env_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".env");
    if let Ok(contents) = fs::read_to_string(&manifest_env_path) {
        for line in contents.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if let Some((key, value)) = trimmed.split_once('=') {
                unsafe {
                    std::env::set_var(key.trim(), value.trim());
                }
            }
        }
    }
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

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
