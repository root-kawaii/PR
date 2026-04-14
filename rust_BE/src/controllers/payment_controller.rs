use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use std::sync::Arc;
use tracing::{info, error, warn};

use crate::application::payment_service::{
    load_all_payments_service,
    load_payment_service,
    create_payment_service,
    create_authorized_payment_service,
    capture_payment_service,
    cancel_payment_authorization_service,
    erase_payment_service,
};
use crate::application::outbox_service;
use crate::models::{PaymentEntity, PaymentRequest, PaymentFilter, AppState, CapturePaymentRequest, CapturePaymentResponse, CancelPaymentRequest, CancelPaymentResponse};
use crate::middleware::auth::ClubOwnerUser;

pub async fn get_all_payments(
    _: ClubOwnerUser,
    State(app_state): State<Arc<AppState>>,
    Query(filters): Query<PaymentFilter>
) -> Result<Json<Vec<PaymentEntity>>, StatusCode> {
    let payments = load_all_payments_service(&app_state, filters).await?;
    Ok(Json(payments))
}

pub async fn get_payment(
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>
) -> Result<Json<PaymentEntity>, StatusCode> {
    let payment = load_payment_service(id, &app_state).await?;
    Ok(Json(payment))
}

pub async fn post_payment(
    _: ClubOwnerUser,
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<PaymentRequest>
) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode> {
    info!(amount = ?payload.amount, "Creating payment");
    let payment = create_payment_service(payload, &app_state).await?;
    info!(payment_id = %payment.id, status = ?payment.status, "Payment created");

    if let Err(error) = outbox_service::enqueue_analytics_event(
        &app_state.db_pool,
        "payment_created",
        None,
        Some("payment"),
        Some(payment.id),
        serde_json::json!({
            "payment_id": payment.id,
            "status": format!("{:?}", payment.status),
        }),
    ).await {
        warn!(error = %error, payment_id = %payment.id, "Failed to enqueue payment created analytics event");
    }

    Ok((StatusCode::CREATED, Json(payment)))
}

pub async fn delete_payment(
    _: ClubOwnerUser,
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>
) -> StatusCode {
    match erase_payment_service(id, &app_state).await {
        Ok(rows) if rows > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => e,
    }
}

// Create payment with authorization (manual capture) — requires club_owner JWT
pub async fn post_authorized_payment(
    _: ClubOwnerUser,
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<PaymentRequest>
) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode> {
    let payment = create_authorized_payment_service(payload, &app_state).await?;
    Ok((StatusCode::CREATED, Json(payment)))
}

// Capture an authorized payment — requires club_owner JWT
pub async fn capture_payment(
    _: ClubOwnerUser,
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<CapturePaymentRequest>
) -> Result<Json<CapturePaymentResponse>, StatusCode> {
    info!(payment_id = %id, amount = ?payload.amount, "Capturing payment");
    let payment = capture_payment_service(id, payload.amount, payload.idempotency_key, &app_state).await
        .map_err(|e| { error!(payment_id = %id, status = ?e, "Payment capture failed"); e })?;

    info!(payment_id = %payment.id, captured_amount = ?payment.captured_amount, "Payment captured successfully");
    let response = CapturePaymentResponse {
        id: payment.id,
        status: payment.status,
        captured_amount: payment.captured_amount.unwrap_or(payment.amount),
        captured_at: payment.captured_at.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
        message: "Payment captured successfully".to_string(),
    };

    if let Err(error) = outbox_service::enqueue_analytics_event(
        &app_state.db_pool,
        "payment_captured",
        None,
        Some("payment"),
        Some(payment.id),
        serde_json::json!({
            "payment_id": payment.id,
            "captured_amount": response.captured_amount,
        }),
    ).await {
        warn!(error = %error, payment_id = %payment.id, "Failed to enqueue payment captured analytics event");
    }

    Ok(Json(response))
}

// Cancel an authorized payment — requires club_owner JWT
pub async fn cancel_payment(
    _: ClubOwnerUser,
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<CancelPaymentRequest>,
) -> Result<Json<CancelPaymentResponse>, StatusCode> {
    info!(payment_id = %id, "Cancelling payment authorization");
    let payment = cancel_payment_authorization_service(id, payload.idempotency_key, &app_state).await
        .map_err(|e| { error!(payment_id = %id, status = ?e, "Payment cancellation failed"); e })?;

    info!(payment_id = %payment.id, "Payment authorization cancelled");
    let response = CancelPaymentResponse {
        id: payment.id,
        status: payment.status,
        cancelled_at: payment.cancelled_at.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
        message: "Payment authorization cancelled successfully".to_string(),
    };

    if let Err(error) = outbox_service::enqueue_analytics_event(
        &app_state.db_pool,
        "payment_cancelled",
        None,
        Some("payment"),
        Some(payment.id),
        serde_json::json!({
            "payment_id": payment.id,
        }),
    ).await {
        warn!(error = %error, payment_id = %payment.id, "Failed to enqueue payment cancelled analytics event");
    }

    Ok(Json(response))
}
