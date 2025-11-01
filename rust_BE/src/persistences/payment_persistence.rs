use crate::models::{PaymentEntity, PaymentRequest, PaymentStatus, PaymentFilter, AppState};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use uuid::Uuid;
use axum::http::StatusCode;
use axum::Json;
use sqlx::{QueryBuilder, Postgres};

pub async fn load_all_payments_service(
    app_state: &AppState,
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
        .fetch_all(&app_state.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

pub async fn load_payment_service(id: Uuid, app_state: &AppState) -> Result<PaymentEntity, StatusCode> {
    sqlx::query_as::<_, PaymentEntity>(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date FROM payments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)
}

use stripe::{CreatePaymentIntent, Currency, PaymentIntent};

pub async fn create_payment_service(
    payload: PaymentRequest, 
    app_state: &AppState
) -> Result<PaymentEntity, StatusCode> {
    let id = Uuid::new_v4();
    
    // Step 1: Create payment intent on Stripe
    // Convert amount from dollars to cents (Stripe expects cents)
    let amount_in_cents = payload.amount.to_i64()
        .ok_or_else(|| {
            eprintln!("Invalid amount: {}", payload.amount);
            StatusCode::BAD_REQUEST
        })? * 100;
    
    let mut params = CreatePaymentIntent::new(amount_in_cents, Currency::USD);
    params.automatic_payment_methods = Some(
        stripe::CreatePaymentIntentAutomaticPaymentMethods {
            enabled: true,
            allow_redirects: None,
        },
    );
    
    // Optional: Add metadata to track the payment in Stripe
    params.metadata = Some(
        [
            ("payment_id".to_string(), id.to_string()),
            ("sender_id".to_string(), payload.sender_id.to_string()),
            ("receiver_id".to_string(), payload.receiver_id.to_string()),
        ]
        .into_iter()
        .collect(),
    );
    
    // Create the payment intent on Stripe
    let payment_intent = PaymentIntent::create(&app_state.stripe_client, params)
        .await
        .map_err(|e| {
            eprintln!("Stripe API error: {:?}", e);
            StatusCode::BAD_GATEWAY
        })?;
    
    println!("✅ Stripe Payment Intent created: {}", payment_intent.id);
    println!("   Client Secret: {:?}", payment_intent.client_secret);
    
    // Step 2: Store payment in database with Stripe payment intent ID
    let payment_entity = sqlx::query_as::<_, PaymentEntity>(
        "INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id"
    )
    .bind(id)
    .bind(&payload.sender_id)
    .bind(&payload.receiver_id)
    .bind(&payload.amount)
    .bind(PaymentStatus::Pending)
    .bind(payload.insert_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payload.update_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payment_intent.id.to_string()) // Store Stripe payment intent ID
    .fetch_one(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    Ok(payment_entity)
}

pub async fn erase_payment_service(id: Uuid, app_state: &AppState) -> Result<u64, StatusCode> {
    sqlx::query(
        "DELETE FROM payments WHERE id = $1"
    )
    .bind(id)
    .execute(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
    .map(|result| result.rows_affected())
}