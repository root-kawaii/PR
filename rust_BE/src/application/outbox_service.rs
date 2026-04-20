use serde_json::json;
use uuid::Uuid;

use crate::application::analytics_service;
use crate::bootstrap::config::AppConfig;
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

pub async fn enqueue_push_notification_for_user(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    title: &str,
    body: &str,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
) -> Result<Option<Uuid>, sqlx::Error> {
    let push_token = sqlx::query_scalar::<_, Option<String>>(
        "SELECT expo_push_token FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .flatten()
    .filter(|token| !token.is_empty());

    match push_token {
        Some(token) => enqueue_push_notification(pool, &token, title, body, aggregate_type, aggregate_id)
            .await
            .map(Some),
        None => Ok(None),
    }
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
    config: &AppConfig,
    event_name: &str,
    distinct_id: Option<&str>,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
    properties: serde_json::Value,
) -> Result<Uuid, sqlx::Error> {
    let properties =
        analytics_service::build_properties(config, aggregate_type, aggregate_id, properties);

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

pub async fn enqueue_analytics_error(
    pool: &sqlx::PgPool,
    config: &AppConfig,
    event_name: &str,
    distinct_id: Option<&str>,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
    error_message: &str,
    properties: serde_json::Value,
) -> Result<Uuid, sqlx::Error> {
    let mut props = match properties {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    props.insert("outcome".to_string(), json!("failure"));
    props.insert("severity".to_string(), json!("error"));
    props.insert("error_message".to_string(), json!(error_message));

    enqueue_analytics_event(
        pool,
        config,
        event_name,
        distinct_id,
        aggregate_type,
        aggregate_id,
        serde_json::Value::Object(props),
    )
    .await
}
