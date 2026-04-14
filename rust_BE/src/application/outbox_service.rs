use serde_json::json;
use uuid::Uuid;

use crate::infrastructure::outbox;

pub async fn enqueue_alert_webhook(
    pool: &sqlx::PgPool,
    message: &str,
    source: &str,
) -> Result<Uuid, sqlx::Error> {
    outbox::enqueue_event(
        pool,
        "notification.alert_webhook",
        Some("system"),
        None,
        json!({
            "message": message,
            "source": source,
        }),
    )
    .await
}

pub async fn enqueue_push_notification(
    pool: &sqlx::PgPool,
    token: &str,
    title: &str,
    body: &str,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
) -> Result<Uuid, sqlx::Error> {
    outbox::enqueue_event(
        pool,
        "notification.push",
        aggregate_type,
        aggregate_id,
        json!({
            "token": token,
            "title": title,
            "body": body,
        }),
    )
    .await
}

pub async fn enqueue_sms_notification(
    pool: &sqlx::PgPool,
    to: &str,
    body: &str,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
) -> Result<Uuid, sqlx::Error> {
    outbox::enqueue_event(
        pool,
        "notification.sms",
        aggregate_type,
        aggregate_id,
        json!({
            "to": to,
            "body": body,
        }),
    )
    .await
}

pub async fn enqueue_analytics_event(
    pool: &sqlx::PgPool,
    event_name: &str,
    distinct_id: Option<&str>,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
    properties: serde_json::Value,
) -> Result<Uuid, sqlx::Error> {
    outbox::enqueue_event(
        pool,
        "analytics.capture",
        aggregate_type,
        aggregate_id,
        json!({
            "event": event_name,
            "distinct_id": distinct_id,
            "properties": properties,
        }),
    )
    .await
}
