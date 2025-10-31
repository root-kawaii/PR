use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::persistences::payment_persistence::{
    load_all_payments_service,
    load_payment_service,
    create_payment_service,
    erase_payment_service,
};

use crate::models::{PaymentEntity, PaymentRequest, PaymentFilter, AppState};


pub async fn get_all_payments(State(pool): State<AppState>) -> Result<Json<Vec<PaymentEntity>>, StatusCode> {
    let filter = PaymentFilter {
        sender_id: None,
        receiver_id: None,
        status: None,
        amount: None,
    };
    let payments = load_all_payments_service(&pool, filter).await?;
    Ok(Json(payments))
}

pub async fn get_payment(Path(id): Path<Uuid>, State(pool): State<AppState>) -> Result<Json<PaymentEntity>, StatusCode> {
    let payment = load_payment_service(id, &pool).await?;
    Ok(Json(payment))
}

pub async fn post_payment(State(pool): State<AppState>, Json(payload): Json<PaymentRequest>) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode> {
    let payment = create_payment_service(payload, &pool).await?;
    Ok((StatusCode::CREATED, Json(payment)))
}

pub async fn delete_payment(Path(id): Path<Uuid>, State(pool): State<AppState>) -> StatusCode {
    match erase_payment_service(id, &pool).await {
        Ok(rows) if rows > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => e,
    }
}