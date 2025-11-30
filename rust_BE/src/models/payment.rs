use serde::{Deserialize, Serialize};
use sqlx::{FromRow};
use uuid::Uuid;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

#[derive(Debug, Serialize, Clone, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Authorized,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Serialize, Clone, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum PaymentCaptureMethod {
    Automatic,
    Manual,
}

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct PaymentEntity {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Uuid,
    pub amount: Decimal,
    pub status: PaymentStatus,
    pub insert_date: chrono::NaiveDateTime,
    pub update_date: Option<chrono::NaiveDateTime>,
    pub stripe_payment_intent_id: Option<String>,
    pub user_ids: Option<Vec<Uuid>>,
    // Authorization & Capture fields
    pub capture_method: Option<PaymentCaptureMethod>,
    pub authorization_status: Option<String>,
    pub authorized_at: Option<chrono::NaiveDateTime>,
    pub captured_at: Option<chrono::NaiveDateTime>,
    pub cancelled_at: Option<chrono::NaiveDateTime>,
    pub authorized_amount: Option<Decimal>,
    pub captured_amount: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentRequest {
    pub sender_id: Uuid,
    pub receiver_id: Uuid,
    pub amount: Decimal,
    pub insert_date: Option<NaiveDateTime>,
    pub update_date: Option<NaiveDateTime>,
    pub stripe_payment_intent_id: Option<String>,
    pub user_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResponse{
    pub id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Uuid,
    pub amount: Decimal,
    pub insert_date: NaiveDateTime,
    pub update_date: Option<NaiveDateTime>,
    pub stripe_payment_intent_id: Option<String>,
    pub user_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, serde::Deserialize)]
pub struct PaymentFilter {
    pub sender_id: Option<i32>,
    pub receiver_id: Option<i32>,
    pub status: Option<PaymentStatus>,
    pub amount: Option<Decimal>,
    // Add any other filterable fields here
}

#[derive(Debug, Deserialize)]
pub struct CapturePaymentRequest {
    pub amount: Option<Decimal>,  // Optional: for partial capture
}

#[derive(Debug, Serialize)]
pub struct CapturePaymentResponse {
    pub id: Uuid,
    pub status: PaymentStatus,
    pub captured_amount: Decimal,
    pub captured_at: NaiveDateTime,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct CancelPaymentResponse {
    pub id: Uuid,
    pub status: PaymentStatus,
    pub cancelled_at: NaiveDateTime,
    pub message: String,
}