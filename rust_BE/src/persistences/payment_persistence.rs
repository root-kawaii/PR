use crate::models::{PaymentEntity, PaymentRequest, PaymentStatus, PaymentFilter, AppState, PaymentCaptureMethod};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use uuid::Uuid;
use axum::http::StatusCode;
use sqlx::{QueryBuilder, Postgres};

pub async fn load_all_payments_service(
    app_state: &AppState,
    filters: PaymentFilter,
) -> Result<Vec<PaymentEntity>, StatusCode> {
    let mut query = QueryBuilder::<Postgres>::new(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount FROM payments WHERE 1=1"
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
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount FROM payments WHERE id = $1"
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

// Helper function to get payment by Stripe payment intent ID
pub async fn load_payment_by_stripe_id(
    stripe_payment_intent_id: &str,
    app_state: &AppState
) -> Result<PaymentEntity, StatusCode> {
    sqlx::query_as::<_, PaymentEntity>(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount FROM payments WHERE stripe_payment_intent_id = $1"
    )
    .bind(stripe_payment_intent_id)
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
        "INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount"
    )
    .bind(id)
    .bind(&payload.sender_id)
    .bind(&payload.receiver_id)
    .bind(&payload.amount)
    .bind(PaymentStatus::Pending)
    .bind(payload.insert_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payload.update_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payment_intent.id.to_string()) // Store Stripe payment intent ID
    .bind(&payload.user_ids) // Store user IDs array
    .bind(PaymentCaptureMethod::Automatic) // Default to automatic capture
    .bind("pending") // Initial authorization status
    .bind(&payload.amount) // Initial authorized amount
    .fetch_one(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(payment_entity)
}

// Create payment with manual capture (authorization only)
pub async fn create_authorized_payment_service(
    payload: PaymentRequest,
    app_state: &AppState
) -> Result<PaymentEntity, StatusCode> {
    let id = Uuid::new_v4();

    // Step 1: Create payment intent with MANUAL capture on Stripe
    let amount_in_cents = payload.amount.to_i64()
        .ok_or_else(|| {
            eprintln!("Invalid amount: {}", payload.amount);
            StatusCode::BAD_REQUEST
        })? * 100;

    let mut params = CreatePaymentIntent::new(amount_in_cents, Currency::EUR);

    // KEY CHANGE: Set capture method to manual
    params.capture_method = Some(stripe::PaymentIntentCaptureMethod::Manual);

    params.automatic_payment_methods = Some(
        stripe::CreatePaymentIntentAutomaticPaymentMethods {
            enabled: true,
            allow_redirects: None,
        },
    );

    params.metadata = Some(
        [
            ("payment_id".to_string(), id.to_string()),
            ("sender_id".to_string(), payload.sender_id.to_string()),
            ("receiver_id".to_string(), payload.receiver_id.to_string()),
        ]
        .into_iter()
        .collect(),
    );

    let payment_intent = PaymentIntent::create(&app_state.stripe_client, params)
        .await
        .map_err(|e| {
            eprintln!("Stripe API error: {:?}", e);
            StatusCode::BAD_GATEWAY
        })?;

    println!("✅ Stripe Payment Intent (MANUAL) created: {}", payment_intent.id);
    println!("   Client Secret: {:?}", payment_intent.client_secret);

    // Step 2: Store payment in database
    let payment_entity = sqlx::query_as::<_, PaymentEntity>(
        "INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount"
    )
    .bind(id)
    .bind(&payload.sender_id)
    .bind(&payload.receiver_id)
    .bind(&payload.amount)
    .bind(PaymentStatus::Pending)
    .bind(payload.insert_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payload.update_date.unwrap_or_else(|| chrono::Utc::now().naive_utc()))
    .bind(payment_intent.id.to_string())
    .bind(&payload.user_ids)
    .bind(PaymentCaptureMethod::Manual) // Manual capture
    .bind("pending") // Will become 'authorized' when customer completes payment
    .bind(&payload.amount)
    .fetch_one(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(payment_entity)
}

// Capture an authorized payment
pub async fn capture_payment_service(
    payment_id: Uuid,
    capture_amount: Option<Decimal>,
    app_state: &AppState
) -> Result<PaymentEntity, StatusCode> {
    // Get existing payment
    let payment = load_payment_service(payment_id, app_state).await?;

    // Verify payment can be captured
    if payment.capture_method != Some(PaymentCaptureMethod::Manual) {
        eprintln!("Payment {} is not set for manual capture", payment_id);
        return Err(StatusCode::BAD_REQUEST);
    }

    if payment.authorization_status != Some("authorized".to_string()) {
        eprintln!("Payment {} is not in 'authorized' state (current: {:?})", payment_id, payment.authorization_status);
        return Err(StatusCode::BAD_REQUEST);
    }

    let stripe_payment_intent_id = payment.stripe_payment_intent_id
        .ok_or_else(|| {
            eprintln!("Payment {} has no Stripe payment intent ID", payment_id);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Determine capture amount
    let amount_to_capture = match capture_amount {
        Some(amt) => {
            // Partial capture
            let cents = amt.to_i64().ok_or(StatusCode::BAD_REQUEST)? * 100;
            Some(cents as u64) // Convert to u64 for Stripe
        },
        None => None, // Full capture
    };

    // Capture via Stripe
    let mut capture_params = stripe::CapturePaymentIntent::default();
    if let Some(amt) = amount_to_capture {
        capture_params.amount_to_capture = Some(amt);
    }

    let payment_intent_id: stripe::PaymentIntentId = stripe_payment_intent_id.parse()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let captured_intent = PaymentIntent::capture(&app_state.stripe_client, &payment_intent_id, capture_params)
        .await
        .map_err(|e| {
            eprintln!("Stripe capture error: {:?}", e);
            StatusCode::BAD_GATEWAY
        })?;

    println!("✅ Payment captured: {}", captured_intent.id);

    // Update database
    let final_captured_amount = capture_amount.unwrap_or(payment.amount);
    let now = chrono::Utc::now().naive_utc();

    let updated_payment = sqlx::query_as::<_, PaymentEntity>(
        "UPDATE payments
         SET status = $1, authorization_status = $2, captured_at = $3, captured_amount = $4, update_date = $5
         WHERE id = $6
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount"
    )
    .bind(PaymentStatus::Completed)
    .bind("captured")
    .bind(now)
    .bind(final_captured_amount)
    .bind(now)
    .bind(payment_id)
    .fetch_one(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(updated_payment)
}

// Cancel an authorized payment
pub async fn cancel_payment_authorization_service(
    payment_id: Uuid,
    app_state: &AppState
) -> Result<PaymentEntity, StatusCode> {
    // Get existing payment
    let payment = load_payment_service(payment_id, app_state).await?;

    // Verify payment can be cancelled
    if payment.capture_method != Some(PaymentCaptureMethod::Manual) {
        eprintln!("Payment {} is not set for manual capture", payment_id);
        return Err(StatusCode::BAD_REQUEST);
    }

    if payment.authorization_status != Some("authorized".to_string()) {
        eprintln!("Payment {} is not in 'authorized' state (current: {:?})", payment_id, payment.authorization_status);
        return Err(StatusCode::BAD_REQUEST);
    }

    let stripe_payment_intent_id = payment.stripe_payment_intent_id
        .ok_or_else(|| {
            eprintln!("Payment {} has no Stripe payment intent ID", payment_id);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Cancel via Stripe
    let payment_intent_id: stripe::PaymentIntentId = stripe_payment_intent_id.parse()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let cancelled_intent = PaymentIntent::cancel(&app_state.stripe_client, &payment_intent_id, stripe::CancelPaymentIntent::default())
        .await
        .map_err(|e| {
            eprintln!("Stripe cancel error: {:?}", e);
            StatusCode::BAD_GATEWAY
        })?;

    println!("✅ Payment authorization cancelled: {}", cancelled_intent.id);

    // Update database
    let now = chrono::Utc::now().naive_utc();

    let updated_payment = sqlx::query_as::<_, PaymentEntity>(
        "UPDATE payments
         SET status = $1, authorization_status = $2, cancelled_at = $3, update_date = $4
         WHERE id = $5
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount"
    )
    .bind(PaymentStatus::Cancelled)
    .bind("cancelled")
    .bind(now)
    .bind(now)
    .bind(payment_id)
    .fetch_one(&app_state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(updated_payment)
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