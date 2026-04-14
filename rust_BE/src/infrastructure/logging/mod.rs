use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use tracing_appender::{
    non_blocking::WorkerGuard,
    rolling::{RollingFileAppender, Rotation},
};
use std::time::Duration;

/// Initialize the tracing subscriber with dual outputs:
/// - Console: colored, human-readable (for development)
/// - File: JSON format, daily rotation (for production)
///
/// Returns a WorkerGuard which MUST be kept alive for the duration of the program.
/// Dropping it will stop async log writing.
pub fn init_logging() -> WorkerGuard {
    // Create logs directory if it doesn't exist
    std::fs::create_dir_all("logs").expect("Failed to create logs directory");

    // File appender: daily rotation, keeps 7 days
    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("rust_be")
        .filename_suffix("log")
        .max_log_files(7)
        .build("logs")
        .expect("Failed to create file appender");

    let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);

    // Environment filter: defaults to INFO, respects RUST_LOG
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    // Console layer: colored, human-readable
    let console_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true)
        .with_ansi(true)
        .pretty();

    // File layer: JSON format for machine parsing
    let file_layer = fmt::layer()
        .json()
        .with_writer(non_blocking_file)
        .with_current_span(true)
        .with_span_list(true);

    // Combine layers
    tracing_subscriber::registry()
        .with(env_filter)
        .with(console_layer)
        .with(file_layer)
        .init();

    guard // MUST be kept alive
}

pub fn log_request_start(request_id: &str, method: &str, route: &str) {
    tracing::info!(
        log_category = "request",
        request_id,
        method,
        route,
        "Request started"
    );
}

pub fn log_request_complete(
    request_id: &str,
    method: &str,
    route: &str,
    status_code: u16,
    latency: Duration,
) {
    tracing::info!(
        log_category = "request",
        request_id,
        method,
        route,
        status_code,
        latency_ms = latency.as_millis() as u64,
        "Request completed"
    );
}

pub fn log_business_event(event_name: &str, entity_type: &str, entity_id: &str) {
    tracing::info!(
        log_category = "business_event",
        event_name,
        entity_type,
        entity_id,
        "Business event"
    );
}

pub fn log_dependency_event(dependency: &str, operation: &str, outcome: &str) {
    tracing::info!(
        log_category = "dependency",
        dependency,
        operation,
        outcome,
        "Dependency call"
    );
}

pub fn log_security_event(event_name: &str, actor_id: Option<&str>) {
    tracing::warn!(
        log_category = "security",
        event_name,
        actor_id = actor_id.unwrap_or("anonymous"),
        "Security event"
    );
}
