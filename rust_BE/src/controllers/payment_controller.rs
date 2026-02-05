use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use std::sync::Arc;

use crate::persistences::payment_persistence::{
    load_all_payments_service,
    load_payment_service,
    create_payment_service,
    create_authorized_payment_service,
    capture_payment_service,
    cancel_payment_authorization_service,
    erase_payment_service,
};
use crate::models::{PaymentEntity, PaymentRequest, PaymentFilter, AppState, CapturePaymentRequest, CapturePaymentResponse, CancelPaymentRequest, CancelPaymentResponse};

pub async fn get_all_payments(
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
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<PaymentRequest>
) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode> {
    let payment = create_payment_service(payload, &app_state).await?;
    Ok((StatusCode::CREATED, Json(payment)))
}

pub async fn delete_payment(
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>
) -> StatusCode {
    match erase_payment_service(id, &app_state).await {
        Ok(rows) if rows > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => e,
    }
}

// Create payment with authorization (manual capture)
pub async fn post_authorized_payment(
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<PaymentRequest>
) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode> {
    let payment = create_authorized_payment_service(payload, &app_state).await?;
    Ok((StatusCode::CREATED, Json(payment)))
}

// Capture an authorized payment
pub async fn capture_payment(
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<CapturePaymentRequest>
) -> Result<Json<CapturePaymentResponse>, StatusCode> {
    let payment = capture_payment_service(id, payload.amount, payload.idempotency_key, &app_state).await?;

    let response = CapturePaymentResponse {
        id: payment.id,
        status: payment.status,
        captured_amount: payment.captured_amount.unwrap_or(payment.amount),
        captured_at: payment.captured_at.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
        message: "Payment captured successfully".to_string(),
    };

    Ok(Json(response))
}

// Cancel an authorized payment
pub async fn cancel_payment(
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<CancelPaymentRequest>,
) -> Result<Json<CancelPaymentResponse>, StatusCode> {
    let payment = cancel_payment_authorization_service(id, payload.idempotency_key, &app_state).await?;

    let response = CancelPaymentResponse {
        id: payment.id,
        status: payment.status,
        cancelled_at: payment.cancelled_at.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
        message: "Payment authorization cancelled successfully".to_string(),
    };

    Ok(Json(response))
}