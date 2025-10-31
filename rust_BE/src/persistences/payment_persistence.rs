use crate::models::{PaymentEntity, PaymentRequest, PaymentStatus, PaymentFilter, AppState};
use uuid::Uuid;
use axum::http::StatusCode;
use axum::Json;
use sqlx::{QueryBuilder, Postgres};


pub async fn load_all_payments_service(
    pool: &AppState,
    filters: PaymentFilter,
) -> Result<Vec<PaymentEntity>, StatusCode> {
    let mut query = QueryBuilder::<Postgres>::new(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date FROM payments WHERE 1=1"
    );
    if let Some(sender_id) = filters.sender_id {
        query.push(" AND sender_id = ").push_bind(sender_id);
    }

    if let Some(receiver_id) = filters.receiver_id {
        query.push(" AND receiver_id = ").push_bind(receiver_id);
    }

    if let Some(status) = filters.status {
        query.push(" AND status = ").push_bind(status);
    }

    if let Some(amount) = filters.amount {
        query.push(" AND amount = ").push_bind(amount);
    }

    query
        .build_query_as::<PaymentEntity>()
        .fetch_all(pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

pub async fn load_payment_service(id: Uuid, pool: &AppState) -> Result<PaymentEntity, StatusCode> {
    sqlx::query_as::<_, PaymentEntity>(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date FROM payments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_payment_service(payload: PaymentRequest, pool: &AppState) -> Result<PaymentEntity, StatusCode> {
    let id = Uuid::new_v4();
    sqlx::query_as::<_, PaymentEntity>(
        "INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date"
    )
    .bind(id)
    .bind(&payload.sender_id)
    .bind(&payload.receiver_id)
    .bind(&payload.amount)
    .bind(PaymentStatus::Pending) // Default status
    .bind(payload.insert_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payload.update_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

pub async fn erase_payment_service(id: Uuid, pool: &AppState) -> Result<u64, StatusCode> {
    sqlx::query(
        "DELETE FROM payments WHERE id = $1"
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
    .map(|result| result.rows_affected())
}