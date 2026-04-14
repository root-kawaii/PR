use serde_json::{json, Value};

use crate::bootstrap::config::AnalyticsConfig;

pub async fn capture_event(
    config: &AnalyticsConfig,
    event_name: &str,
    distinct_id: &str,
    properties: Value,
) -> Result<(), String> {
    let Some(api_key) = &config.posthog_api_key else {
        tracing::info!(event = event_name, "PostHog not configured, analytics event kept local");
        return Ok(());
    };

    let host = config.posthog_host.trim_end_matches('/');
    let body = json!({
        "api_key": api_key,
        "event": event_name,
        "distinct_id": distinct_id,
        "properties": properties,
    });

    let response = reqwest::Client::new()
        .post(format!("{host}/capture/"))
        .json(&body)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("PostHog returned status {}", response.status()))
    }
}
