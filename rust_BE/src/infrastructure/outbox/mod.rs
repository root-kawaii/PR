use chrono::{Duration, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OutboxEvent {
    pub id: Uuid,
    pub event_type: String,
    pub aggregate_type: Option<String>,
    pub aggregate_id: Option<Uuid>,
    pub payload: Value,
    pub status: String,
    pub attempts: i32,
    pub available_at: chrono::DateTime<Utc>,
    pub last_error: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
    pub processed_at: Option<chrono::DateTime<Utc>>,
}

pub async fn enqueue_event(
    pool: &PgPool,
    event_type: &str,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
    payload: Value,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO outbox_events (
            id, event_type, aggregate_type, aggregate_id, payload, status,
            attempts, available_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', 0, NOW(), NOW(), NOW())
        "#,
    )
    .bind(id)
    .bind(event_type)
    .bind(aggregate_type)
    .bind(aggregate_id)
    .bind(payload)
    .execute(pool)
    .await?;

    Ok(id)
}

pub async fn claim_pending_events(
    pool: &PgPool,
    batch_size: i64,
) -> Result<Vec<OutboxEvent>, sqlx::Error> {
    sqlx::query_as::<_, OutboxEvent>(
        r#"
        WITH next_events AS (
            SELECT id
            FROM outbox_events
            WHERE status IN ('pending', 'failed')
              AND available_at <= NOW()
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_events oe
        SET status = 'processing',
            attempts = attempts + 1,
            updated_at = NOW()
        FROM next_events
        WHERE oe.id = next_events.id
        RETURNING
            oe.id,
            oe.event_type,
            oe.aggregate_type,
            oe.aggregate_id,
            oe.payload,
            oe.status,
            oe.attempts,
            oe.available_at,
            oe.last_error,
            oe.created_at,
            oe.processed_at
        "#,
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await
}

pub async fn mark_delivered(pool: &PgPool, event_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE outbox_events
        SET status = 'delivered',
            processed_at = NOW(),
            updated_at = NOW(),
            last_error = NULL
        WHERE id = $1
        "#,
    )
    .bind(event_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_failed(
    pool: &PgPool,
    event_id: Uuid,
    error_message: &str,
    retry_delay: Duration,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE outbox_events
        SET status = 'failed',
            last_error = $2,
            available_at = $3,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(event_id)
    .bind(error_message)
    .bind(Utc::now() + retry_delay)
    .execute(pool)
    .await?;

    Ok(())
}
