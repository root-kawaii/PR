use crate::models::{
    AppState, PaymentCaptureMethod, PaymentEntity, PaymentFilter, PaymentRequest, PaymentStatus,
};
use crate::idempotency::IdempotencyCheckResult;
use axum::http::StatusCode;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sqlx::{Postgres, QueryBuilder};
use uuid::Uuid;
use tracing::{info, warn, error};

pub async fn load_all_payments_service(
    app_state: &AppState,
    filters: PaymentFilter,
) -> Result<Vec<PaymentEntity>, StatusCode> {
    let limit = filters.limit.unwrap_or(50).min(200);
    let offset = filters.offset.unwrap_or(0);

    let mut query = QueryBuilder::<Postgres>::new(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id FROM payments WHERE 1=1"
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

    query.push(" ORDER BY insert_date DESC LIMIT ").push_bind(limit);
    query.push(" OFFSET ").push_bind(offset);

    query
        .build_query_as::<PaymentEntity>()
        .fetch_all(&app_state.db_pool)
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to load payments from database");
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

pub async fn load_payment_service(
    id: Uuid,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    sqlx::query_as::<_, PaymentEntity>(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id FROM payments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&app_state.db_pool)
    .await
    .map_err(|e| {
        error!(error = %e, payment_id = %id, "Failed to load payment from database");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)
}

// Helper function to get payment by Stripe payment intent ID
pub async fn load_payment_by_stripe_id(
    stripe_payment_intent_id: &str,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    sqlx::query_as::<_, PaymentEntity>(
        "SELECT id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id FROM payments WHERE stripe_payment_intent_id = $1"
    )
    .bind(stripe_payment_intent_id)
    .fetch_optional(&app_state.db_pool)
    .await
    .map_err(|e| {
        error!(error = %e, stripe_payment_intent_id = %stripe_payment_intent_id, "Failed to load payment by Stripe ID");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)
}

use stripe::{CreatePaymentIntent, Currency, PaymentIntent};

pub async fn create_payment_service(
    payload: PaymentRequest,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    // If idempotency key provided, use idempotency service
    if let Some(idempotency_key) = payload.idempotency_key {
        // Calculate request hash
        let request_hash = app_state.idempotency_service.calculate_hash(&payload);

        // Check for existing idempotency record
        match app_state.idempotency_service.check_idempotency(idempotency_key, &request_hash).await? {
            IdempotencyCheckResult::Proceed => {
                // Create idempotency record (acts as distributed lock)
                if !app_state.idempotency_service.create_idempotency_record(idempotency_key, request_hash).await? {
                    // Another request won the race - wait for completion
                    let payment_id = app_state.idempotency_service.wait_for_completion(idempotency_key).await?;
                    return load_payment_service(payment_id, app_state).await;
                }

                // We won the race - execute the operation
                match create_payment_internal(payload.clone(), app_state).await {
                    Ok(payment) => {
                        // Mark as completed
                        app_state.idempotency_service.mark_completed(idempotency_key, payment.id).await?;
                        Ok(payment)
                    }
                    Err(e) => {
                        // Mark as failed
                        app_state.idempotency_service.mark_failed(idempotency_key, format!("{:?}", e)).await.ok();
                        Err(e)
                    }
                }
            }

            IdempotencyCheckResult::AlreadyCompleted(payment_id) => {
                // Return existing payment
                warn!(payment_id = %payment_id, idempotency_key = %idempotency_key, "Duplicate payment request detected - returning existing payment");
                load_payment_service(payment_id, app_state).await
            }

            IdempotencyCheckResult::InProgress => {
                // Wait for in-progress operation to complete
                info!(idempotency_key = %idempotency_key, "Payment already in progress - waiting for completion");
                let payment_id = app_state.idempotency_service.wait_for_completion(idempotency_key).await?;
                load_payment_service(payment_id, app_state).await
            }

            IdempotencyCheckResult::PreviouslyFailed(error) => {
                // Previous attempt failed - retry
                warn!(error = %error, idempotency_key = %idempotency_key, "Previous payment attempt failed - retrying");
                create_payment_internal(payload, app_state).await
            }

            IdempotencyCheckResult::HashMismatch => {
                error!(idempotency_key = %idempotency_key, "Idempotency key reused with different payload");
                Err(StatusCode::UNPROCESSABLE_ENTITY)
            }
        }
    } else {
        // No idempotency key - execute directly (backward compatibility)
        create_payment_internal(payload, app_state).await
    }
}

// Internal function with actual payment creation logic
async fn create_payment_internal(
    payload: PaymentRequest,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    let id = Uuid::new_v4();

    // Validate amount
    if payload.amount <= Decimal::ZERO {
        error!(amount = %payload.amount, "Payment amount must be positive");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Step 1: Create payment intent on Stripe
    // Convert amount from euros to cents (Stripe expects cents)
    let amount_in_cents = payload.amount.to_i64().ok_or_else(|| {
        error!(amount = %payload.amount, "Invalid payment amount");
        StatusCode::BAD_REQUEST
    })? * 100;

    let mut params = CreatePaymentIntent::new(amount_in_cents, Currency::EUR);
    params.automatic_payment_methods = Some(stripe::CreatePaymentIntentAutomaticPaymentMethods {
        enabled: true,
        allow_redirects: None,
    });

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
            error!(error = ?e, amount_cents = amount_in_cents, "Failed to create Stripe payment intent");
            StatusCode::BAD_GATEWAY
        })?;

    info!(payment_intent_id = %payment_intent.id, amount_cents = amount_in_cents, "Stripe payment intent created");

    // Step 2: Store payment in database with Stripe payment intent ID
    let payment_entity = sqlx::query_as::<_, PaymentEntity>(
        "INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id"
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
        error!(error = %e, payment_id = %id, "Failed to insert payment into database");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!(payment_id = %payment_entity.id, amount = %payment_entity.amount, "Payment created successfully");
    Ok(payment_entity)
}

// Create payment with manual capture (authorization only)
pub async fn create_authorized_payment_service(
    payload: PaymentRequest,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    // If idempotency key provided, use idempotency service
    if let Some(idempotency_key) = payload.idempotency_key {
        let request_hash = app_state.idempotency_service.calculate_hash(&payload);

        match app_state.idempotency_service.check_idempotency(idempotency_key, &request_hash).await? {
            IdempotencyCheckResult::Proceed => {
                if !app_state.idempotency_service.create_idempotency_record(idempotency_key, request_hash).await? {
                    let payment_id = app_state.idempotency_service.wait_for_completion(idempotency_key).await?;
                    return load_payment_service(payment_id, app_state).await;
                }

                match create_authorized_payment_internal(payload.clone(), app_state).await {
                    Ok(payment) => {
                        app_state.idempotency_service.mark_completed(idempotency_key, payment.id).await?;
                        Ok(payment)
                    }
                    Err(e) => {
                        app_state.idempotency_service.mark_failed(idempotency_key, format!("{:?}", e)).await.ok();
                        Err(e)
                    }
                }
            }

            IdempotencyCheckResult::AlreadyCompleted(payment_id) => {
                warn!(payment_id = %payment_id, idempotency_key = %idempotency_key, "Duplicate authorized payment request - returning existing payment");
                load_payment_service(payment_id, app_state).await
            }

            IdempotencyCheckResult::InProgress => {
                info!(idempotency_key = %idempotency_key, "Authorized payment already in progress - waiting");
                let payment_id = app_state.idempotency_service.wait_for_completion(idempotency_key).await?;
                load_payment_service(payment_id, app_state).await
            }

            IdempotencyCheckResult::PreviouslyFailed(error) => {
                warn!(error = %error, idempotency_key = %idempotency_key, "Previous authorized payment failed - retrying");
                create_authorized_payment_internal(payload, app_state).await
            }

            IdempotencyCheckResult::HashMismatch => {
                error!(idempotency_key = %idempotency_key, "Idempotency key reused with different payload");
                Err(StatusCode::UNPROCESSABLE_ENTITY)
            }
        }
    } else {
        create_authorized_payment_internal(payload, app_state).await
    }
}

async fn create_authorized_payment_internal(
    payload: PaymentRequest,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    let id = Uuid::new_v4();

    // Validate amount
    if payload.amount <= Decimal::ZERO {
        error!(amount = %payload.amount, "Payment amount must be positive");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Step 1: Create payment intent with MANUAL capture on Stripe
    let amount_in_cents = payload.amount.to_i64().ok_or_else(|| {
        error!(amount = %payload.amount, "Invalid payment amount");
        StatusCode::BAD_REQUEST
    })? * 100;

    let mut params = CreatePaymentIntent::new(amount_in_cents, Currency::EUR);

    // KEY CHANGE: Set capture method to manual
    params.capture_method = Some(stripe::PaymentIntentCaptureMethod::Manual);

    params.automatic_payment_methods = Some(stripe::CreatePaymentIntentAutomaticPaymentMethods {
        enabled: true,
        allow_redirects: None,
    });

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
            error!(error = ?e, amount_cents = amount_in_cents, "Failed to create Stripe payment intent (manual capture)");
            StatusCode::BAD_GATEWAY
        })?;

    info!(payment_intent_id = %payment_intent.id, amount_cents = amount_in_cents, capture_method = "manual", "Stripe payment intent created");

    // Step 2: Store payment in database
    let payment_entity = sqlx::query_as::<_, PaymentEntity>(
        "INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id"
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
        error!(error = %e, payment_id = %id, "Failed to insert authorized payment into database");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!(payment_id = %payment_entity.id, amount = %payment_entity.amount, capture_method = "manual", "Authorized payment created successfully");
    Ok(payment_entity)
}

// Capture an authorized payment (with idempotency)
pub async fn capture_payment_service(
    payment_id: Uuid,
    capture_amount: Option<Decimal>,
    idempotency_key: Option<Uuid>,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    if let Some(key) = idempotency_key {
        let hash_payload = serde_json::json!({
            "action": "capture",
            "payment_id": payment_id.to_string(),
            "amount": capture_amount.map(|a| a.to_string()),
        });
        let request_hash = app_state.idempotency_service.calculate_hash(&hash_payload);

        match app_state.idempotency_service.check_idempotency(key, &request_hash).await? {
            IdempotencyCheckResult::Proceed => {
                if !app_state.idempotency_service.create_idempotency_record(key, request_hash).await? {
                    let result_id = app_state.idempotency_service.wait_for_completion(key).await?;
                    return load_payment_service(result_id, app_state).await;
                }
                match capture_payment_internal(payment_id, capture_amount, app_state).await {
                    Ok(payment) => {
                        app_state.idempotency_service.mark_completed(key, payment.id).await?;
                        Ok(payment)
                    }
                    Err(e) => {
                        app_state.idempotency_service.mark_failed(key, format!("{:?}", e)).await.ok();
                        Err(e)
                    }
                }
            }
            IdempotencyCheckResult::AlreadyCompleted(result_id) => {
                warn!(payment_id = %payment_id, idempotency_key = %key, "Duplicate capture request - returning existing");
                load_payment_service(result_id, app_state).await
            }
            IdempotencyCheckResult::InProgress => {
                info!(idempotency_key = %key, "Capture already in progress - waiting");
                let result_id = app_state.idempotency_service.wait_for_completion(key).await?;
                load_payment_service(result_id, app_state).await
            }
            IdempotencyCheckResult::PreviouslyFailed(error) => {
                warn!(error = %error, idempotency_key = %key, "Previous capture failed - retrying");
                capture_payment_internal(payment_id, capture_amount, app_state).await
            }
            IdempotencyCheckResult::HashMismatch => {
                error!(idempotency_key = %key, "Idempotency key reused with different capture payload");
                Err(StatusCode::UNPROCESSABLE_ENTITY)
            }
        }
    } else {
        capture_payment_internal(payment_id, capture_amount, app_state).await
    }
}

async fn capture_payment_internal(
    payment_id: Uuid,
    capture_amount: Option<Decimal>,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    let payment = load_payment_service(payment_id, app_state).await?;

    if payment.capture_method != Some(PaymentCaptureMethod::Manual) {
        error!(payment_id = %payment_id, "Payment is not set for manual capture");
        return Err(StatusCode::BAD_REQUEST);
    }

    if payment.authorization_status != Some("authorized".to_string()) {
        error!(payment_id = %payment_id, current_status = ?payment.authorization_status, "Payment is not in 'authorized' state");
        return Err(StatusCode::BAD_REQUEST);
    }

    let stripe_payment_intent_id = payment.stripe_payment_intent_id.ok_or_else(|| {
        error!(payment_id = %payment_id, "Payment has no Stripe payment intent ID");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let amount_to_capture = match capture_amount {
        Some(amt) => {
            let cents = amt.to_i64().ok_or(StatusCode::BAD_REQUEST)? * 100;
            Some(cents as u64)
        }
        None => None,
    };

    let mut capture_params = stripe::CapturePaymentIntent::default();
    if let Some(amt) = amount_to_capture {
        capture_params.amount_to_capture = Some(amt);
    }

    let payment_intent_id: stripe::PaymentIntentId = stripe_payment_intent_id
        .parse()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let captured_intent =
        PaymentIntent::capture(&app_state.stripe_client, &payment_intent_id, capture_params)
            .await
            .map_err(|e| {
                error!(error = ?e, payment_id = %payment_id, stripe_payment_intent_id = %stripe_payment_intent_id, "Failed to capture payment on Stripe");
                StatusCode::BAD_GATEWAY
            })?;

    info!(payment_id = %payment_id, stripe_payment_intent_id = %captured_intent.id, "Payment captured successfully");

    let final_captured_amount = capture_amount.unwrap_or(payment.amount);
    let now = chrono::Utc::now().naive_utc();

    let updated_payment = sqlx::query_as::<_, PaymentEntity>(
        "UPDATE payments
         SET status = $1, authorization_status = $2, captured_at = $3, captured_amount = $4, update_date = $5
         WHERE id = $6
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id"
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
        error!(error = %e, payment_id = %payment_id, "Failed to update payment capture status in database");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(updated_payment)
}

// Cancel an authorized payment (with idempotency)
pub async fn cancel_payment_authorization_service(
    payment_id: Uuid,
    idempotency_key: Option<Uuid>,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    if let Some(key) = idempotency_key {
        let hash_payload = serde_json::json!({
            "action": "cancel",
            "payment_id": payment_id.to_string(),
        });
        let request_hash = app_state.idempotency_service.calculate_hash(&hash_payload);

        match app_state.idempotency_service.check_idempotency(key, &request_hash).await? {
            IdempotencyCheckResult::Proceed => {
                if !app_state.idempotency_service.create_idempotency_record(key, request_hash).await? {
                    let result_id = app_state.idempotency_service.wait_for_completion(key).await?;
                    return load_payment_service(result_id, app_state).await;
                }
                match cancel_payment_internal(payment_id, app_state).await {
                    Ok(payment) => {
                        app_state.idempotency_service.mark_completed(key, payment.id).await?;
                        Ok(payment)
                    }
                    Err(e) => {
                        app_state.idempotency_service.mark_failed(key, format!("{:?}", e)).await.ok();
                        Err(e)
                    }
                }
            }
            IdempotencyCheckResult::AlreadyCompleted(result_id) => {
                warn!(payment_id = %payment_id, idempotency_key = %key, "Duplicate cancel request - returning existing");
                load_payment_service(result_id, app_state).await
            }
            IdempotencyCheckResult::InProgress => {
                info!(idempotency_key = %key, "Cancel already in progress - waiting");
                let result_id = app_state.idempotency_service.wait_for_completion(key).await?;
                load_payment_service(result_id, app_state).await
            }
            IdempotencyCheckResult::PreviouslyFailed(error) => {
                warn!(error = %error, idempotency_key = %key, "Previous cancel failed - retrying");
                cancel_payment_internal(payment_id, app_state).await
            }
            IdempotencyCheckResult::HashMismatch => {
                error!(idempotency_key = %key, "Idempotency key reused with different cancel payload");
                Err(StatusCode::UNPROCESSABLE_ENTITY)
            }
        }
    } else {
        cancel_payment_internal(payment_id, app_state).await
    }
}

async fn cancel_payment_internal(
    payment_id: Uuid,
    app_state: &AppState,
) -> Result<PaymentEntity, StatusCode> {
    let payment = load_payment_service(payment_id, app_state).await?;

    if payment.capture_method != Some(PaymentCaptureMethod::Manual) {
        error!(payment_id = %payment_id, "Payment is not set for manual capture");
        return Err(StatusCode::BAD_REQUEST);
    }

    if payment.authorization_status != Some("authorized".to_string()) {
        error!(payment_id = %payment_id, current_status = ?payment.authorization_status, "Payment is not in 'authorized' state");
        return Err(StatusCode::BAD_REQUEST);
    }

    let stripe_payment_intent_id = payment.stripe_payment_intent_id.ok_or_else(|| {
        error!(payment_id = %payment_id, "Payment has no Stripe payment intent ID");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let payment_intent_id: stripe::PaymentIntentId = stripe_payment_intent_id
        .parse()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let cancelled_intent = PaymentIntent::cancel(
        &app_state.stripe_client,
        &payment_intent_id,
        stripe::CancelPaymentIntent::default(),
    )
    .await
    .map_err(|e| {
        error!(error = ?e, payment_id = %payment_id, stripe_payment_intent_id = %stripe_payment_intent_id, "Failed to cancel payment on Stripe");
        StatusCode::BAD_GATEWAY
    })?;

    info!(payment_id = %payment_id, stripe_payment_intent_id = %cancelled_intent.id, "Payment authorization cancelled successfully");

    let now = chrono::Utc::now().naive_utc();

    let updated_payment = sqlx::query_as::<_, PaymentEntity>(
        "UPDATE payments
         SET status = $1, authorization_status = $2, cancelled_at = $3, update_date = $4
         WHERE id = $5
         RETURNING id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, authorized_at, captured_at, cancelled_at, authorized_amount, captured_amount, stripe_customer_id, stripe_payment_method_id"
    )
    .bind(PaymentStatus::Cancelled)
    .bind("cancelled")
    .bind(now)
    .bind(now)
    .bind(payment_id)
    .fetch_one(&app_state.db_pool)
    .await
    .map_err(|e| {
        error!(error = %e, payment_id = %payment_id, "Failed to update payment cancellation status in database");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(updated_payment)
}

pub async fn erase_payment_service(id: Uuid, app_state: &AppState) -> Result<u64, StatusCode> {
    sqlx::query("DELETE FROM payments WHERE id = $1")
        .bind(id)
        .execute(&app_state.db_pool)
        .await
        .map_err(|e| {
            error!(error = %e, payment_id = %id, "Failed to delete payment from database");
            StatusCode::INTERNAL_SERVER_ERROR
        })
        .map(|result| {
            let rows = result.rows_affected();
            if rows > 0 {
                info!(payment_id = %id, "Payment deleted successfully");
            }
            rows
        })
}
