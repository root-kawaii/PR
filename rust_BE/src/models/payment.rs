use serde::{Deserialize, Serialize};
use sqlx::{FromRow};
use uuid::Uuid;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

#[derive(Debug, Serialize, Clone, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Completed,
    Failed,
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
}

#[derive(Debug, Deserialize)]
pub struct PaymentRequest {
    pub sender_id: Uuid,
    pub receiver_id: Uuid,  
    pub amount: Decimal,
    pub insert_date: Option<NaiveDateTime>,  
    pub update_date: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResponse{
    pub id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Uuid,  
    pub amount: Decimal,
    pub insert_date: NaiveDateTime,  
    pub update_date: Option<NaiveDateTime>,
}

#[derive(Debug, serde::Deserialize)]
pub struct PaymentFilter {
    pub sender_id: Option<i32>,
    pub receiver_id: Option<i32>,
    pub status: Option<PaymentStatus>,
    pub amount: Option<Decimal>,
    // Add any other filterable fields here
}