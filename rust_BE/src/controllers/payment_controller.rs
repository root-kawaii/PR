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
    erase_payment_service,
};
use crate::models::{PaymentEntity, PaymentRequest, PaymentFilter, AppState};

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