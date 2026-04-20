use std::sync::Arc;

use chrono::Duration;
use serde_json::{json, Value};
use tracing::{error, warn};

use crate::bootstrap::state::AppState;
use crate::infrastructure::outbox::{self, OutboxEvent};

pub async fn run(state: Arc<AppState>) {
    let interval_seconds = state.config.analytics.outbox_poll_interval_seconds;
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_seconds));

    loop {
        interval.tick().await;

        let claimed = match outbox::claim_pending_events(
            &state.db_pool,
            state.config.analytics.outbox_batch_size,
        )
        .await
        {
            Ok(events) => events,
            Err(error) => {
                error!(error = %error, "Outbox dispatcher failed to claim events");
                crate::jobs::record_job_run(
                    &state,
                    "outbox_dispatcher",
                    "failure",
                    json!({}),
                    Some(&error.to_string()),
                )
                .await;
                continue;
            }
        };

        if claimed.is_empty() {
            continue;
        }

        let mut delivered = 0;
        let mut failed = 0;

        for event in claimed {
            match dispatch_event(&state, &event).await {
                Ok(()) => {
                    delivered += 1;
                    if let Err(error) = outbox::mark_delivered(&state.db_pool, event.id).await {
                        error!(event_id = %event.id, error = %error, "Failed to mark outbox event delivered");
                    }
                }
                Err(dispatch_error) => {
                    failed += 1;
                    warn!(
                        event_id = %event.id,
                        event_type = %event.event_type,
                        error = %dispatch_error,
                        "Outbox dispatch failed"
                    );
                    if let Err(mark_error) = outbox::mark_failed(
                        &state.db_pool,
                        event.id,
                        &dispatch_error,
                        Duration::seconds((event.attempts.max(1) as i64) * 30),
                    )
                    .await
                    {
                        error!(event_id = %event.id, error = %mark_error, "Failed to mark outbox event failed");
                    }
                }
            }
        }

        crate::jobs::record_job_run(
            &state,
            "outbox_dispatcher",
            if failed == 0 {
                "success"
            } else {
                "partial_failure"
            },
            json!({
                "claimed": delivered + failed,
                "delivered": delivered,
                "failed": failed,
            }),
            None,
        )
        .await;
    }
}

async fn dispatch_event(state: &AppState, event: &OutboxEvent) -> Result<(), String> {
    match event.event_type.as_str() {
        "notification.alert_webhook" => dispatch_alert_webhook(state, &event.payload).await,
        "notification.push" => dispatch_push_notification(state, &event.payload).await,
        "notification.sms" => dispatch_sms_notification(state, &event.payload).await,
        "analytics.capture" => dispatch_analytics_event(state, &event.payload).await,
        unsupported => Err(format!("Unsupported outbox event type: {unsupported}")),
    }
}

async fn dispatch_alert_webhook(state: &AppState, payload: &Value) -> Result<(), String> {
    let url = state
        .config
        .notifications
        .alert_webhook_url
        .clone()
        .ok_or_else(|| "ALERT_WEBHOOK_URL not configured".to_string())?;
    let message = payload
        .get("message")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing alert webhook message".to_string())?;

    let payload = json!({
        "content": message,
        "text": message,
    });

    let response = reqwest::Client::new()
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Alert webhook returned status {}",
            response.status()
        ))
    }
}

async fn dispatch_push_notification(state: &AppState, payload: &Value) -> Result<(), String> {
    let token = payload
        .get("token")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing push token".to_string())?;
    let title = payload
        .get("title")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing push title".to_string())?;
    let body = payload
        .get("body")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing push body".to_string())?;

    crate::services::notification_service::send_push_notification(&state.config, token, title, body)
        .await
        .map_err(|error| error.to_string())
}

async fn dispatch_sms_notification(state: &AppState, payload: &Value) -> Result<(), String> {
    let to = payload
        .get("to")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing sms destination".to_string())?;
    let body = payload
        .get("body")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing sms body".to_string())?;

    crate::services::notification_service::send_sms(&state.config, to, body)
        .await
        .map_err(|error| error.to_string())
}

async fn dispatch_analytics_event(state: &AppState, payload: &Value) -> Result<(), String> {
    let event_name = payload
        .get("event")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing analytics event name".to_string())?;
    let distinct_id = payload
        .get("distinct_id")
        .and_then(Value::as_str)
        .unwrap_or("system");
    let properties = payload
        .get("properties")
        .cloned()
        .unwrap_or_else(|| json!({}));

    crate::infrastructure::analytics::posthog::capture_event(
        &state.config.analytics,
        event_name,
        distinct_id,
        properties,
    )
    .await
}
