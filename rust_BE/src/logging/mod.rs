use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use tracing_appender::{
    non_blocking::WorkerGuard,
    rolling::{RollingFileAppender, Rotation},
};

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
