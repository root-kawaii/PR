use crate::models::{AppState, PaymentStatus};
use crate::persistences::table_persistence;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    body::Bytes,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::sync::Arc;
use uuid::Uuid;
use rust_decimal::Decimal;
use tracing::{info, warn, error};

type HmacSha256 = Hmac<Sha256>;

pub async fn handle_stripe_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    // Extract Stripe-Signature header
    let signature_header = match headers.get("Stripe-Signature").and_then(|v| v.to_str().ok()) {
        Some(sig) => sig.to_string(),
        None => {
            warn!("Missing Stripe-Signature header");
            return StatusCode::BAD_REQUEST;
        }
    };

    // Parse t= and v1= from signature header
    let mut timestamp = None;
    let mut signature = None;
    for part in signature_header.split(',') {
        let part = part.trim();
        if let Some(t) = part.strip_prefix("t=") {
            timestamp = Some(t.to_string());
        } else if let Some(v1) = part.strip_prefix("v1=") {
            signature = Some(v1.to_string());
        }
    }

    let timestamp = match timestamp {
        Some(t) => t,
        None => {
            warn!("Missing timestamp in Stripe-Signature");
            return StatusCode::BAD_REQUEST;
        }
    };

    let expected_sig = match signature {
        Some(s) => s,
        None => {
            warn!("Missing v1 signature in Stripe-Signature");
            return StatusCode::BAD_REQUEST;
        }
    };

    // Verify HMAC-SHA256 signature (skip if secret not configured)
    if !state.stripe_webhook_secret.is_empty() {
        let signed_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(&body));

        let mut mac = match HmacSha256::new_from_slice(state.stripe_webhook_secret.as_bytes()) {
            Ok(m) => m,
            Err(_) => {
                error!("Invalid webhook secret configuration");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        };
        mac.update(signed_payload.as_bytes());
        let computed_sig = hex::encode(mac.finalize().into_bytes());

        if computed_sig != expected_sig {
            warn!("Invalid Stripe webhook signature");
            return StatusCode::BAD_REQUEST;
        }
    }

    // Parse JSON event payload
    let event: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            error!(error = %e, "Failed to parse webhook payload");
            return StatusCode::BAD_REQUEST;
        }
    };

    let event_type = event["type"].as_str().unwrap_or("");
    let payment_intent_id = event["data"]["object"]["id"].as_str().unwrap_or("");

    info!(event_type = %event_type, payment_intent_id = %payment_intent_id, "Received Stripe webhook");

    match event_type {
        "payment_intent.succeeded" => {
            update_payment_status(&state, payment_intent_id, PaymentStatus::Completed).await
        }
        "payment_intent.payment_failed" => {
            update_payment_status(&state, payment_intent_id, PaymentStatus::Failed).await
        }
        "checkout.session.completed" => {
            let session_id = event["data"]["object"]["id"].as_str().unwrap_or("");
            handle_checkout_session_completed(&state, session_id, &event).await
        }
        // Fired when a manual-capture PaymentIntent is authorized (requires_capture).
        // We store authorized_at and the payment_method_id here so the scheduler
        // can re-authorize off-session if the 7-day hold is about to expire.
        "payment_intent.amount_capturable_updated" => {
            let payment_method_id = event["data"]["object"]["payment_method"]
                .as_str()
                .unwrap_or("")
                .to_string();
            store_authorization(&state, payment_intent_id, &payment_method_id).await
        }
        _ => {
            info!(event_type = %event_type, "Unhandled Stripe webhook event type");
            StatusCode::OK
        }
    }
}

async fn store_authorization(
    state: &AppState,
    payment_intent_id: &str,
    payment_method_id: &str,
) -> StatusCode {
    match sqlx::query(
        "UPDATE payments
         SET authorization_status = 'authorized',
             authorized_at = NOW(),
             stripe_payment_method_id = COALESCE(NULLIF($1, ''), stripe_payment_method_id),
             update_date = NOW()
         WHERE stripe_payment_intent_id = $2"
    )
    .bind(payment_method_id)
    .bind(payment_intent_id)
    .execute(&state.db_pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!(payment_intent_id = %payment_intent_id, "Payment authorization stored");
            }
            StatusCode::OK
        }
        Err(e) => {
            error!(error = %e, payment_intent_id = %payment_intent_id, "Failed to store payment authorization");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn update_payment_status(
    state: &AppState,
    payment_intent_id: &str,
    status: PaymentStatus,
) -> StatusCode {
    match sqlx::query(
        "UPDATE payments SET status = $1, update_date = NOW() WHERE stripe_payment_intent_id = $2"
    )
    .bind(&status)
    .bind(payment_intent_id)
    .execute(&state.db_pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!(payment_intent_id = %payment_intent_id, status = ?status, "Payment status updated");
            } else {
                info!(payment_intent_id = %payment_intent_id, "No payment found for this PaymentIntent (may be external)");
            }
            StatusCode::OK
        }
        Err(e) => {
            error!(error = %e, payment_intent_id = %payment_intent_id, "Failed to update payment status");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

/// Handle checkout.session.completed webhook for guest split payments
async fn handle_checkout_session_completed(
    state: &AppState,
    session_id: &str,
    event: &serde_json::Value,
) -> StatusCode {
    info!(session_id = %session_id, "Processing checkout.session.completed");

    // Look up the payment share by checkout session ID
    let share = match table_persistence::get_payment_share_by_checkout_session(&state.db_pool, session_id).await {
        Ok(share) => share,
        Err(_) => {
            info!(session_id = %session_id, "No payment share found for checkout session (may be external)");
            return StatusCode::OK;
        }
    };

    if share.status == "paid" {
        info!(share_id = %share.id, "Payment share already marked as paid, skipping");
        return StatusCode::OK;
    }

    // Extract Stripe PaymentIntent ID from the checkout session
    let stripe_pi_id = event["data"]["object"]["payment_intent"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let now = chrono::Utc::now().naive_utc();

    // Create payment record for this guest
    let payment_id = Uuid::new_v4();
    let sender_id = share.user_id.unwrap_or_else(Uuid::nil);

    match sqlx::query(
        r#"
        INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#
    )
    .bind(payment_id)
    .bind(sender_id)
    .bind(sender_id)
    .bind(share.amount)
    .bind(PaymentStatus::Completed)
    .bind(now)
    .bind(now)
    .bind(&stripe_pi_id)
    .bind(&vec![sender_id])
    .execute(&state.db_pool)
    .await
    {
        Ok(_) => info!(payment_id = %payment_id, "Created payment record for guest"),
        Err(e) => {
            error!(error = %e, "Failed to create payment record for guest");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }

    // Update payment share to paid
    match table_persistence::update_payment_share_paid(
        &state.db_pool,
        share.id,
        payment_id,
        if stripe_pi_id.is_empty() { None } else { Some(stripe_pi_id) },
    )
    .await
    {
        Ok(_) => info!(share_id = %share.id, "Payment share marked as paid"),
        Err(e) => {
            error!(error = %e, share_id = %share.id, "Failed to update payment share");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }

    // Update reservation amount_paid
    match table_persistence::increment_reservation_amount_paid(
        &state.db_pool,
        share.reservation_id,
        share.amount,
    )
    .await
    {
        Ok(_) => info!(reservation_id = %share.reservation_id, amount = %share.amount, "Reservation amount_paid updated"),
        Err(e) => {
            error!(error = %e, "Failed to update reservation amount_paid");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }

    // Add payment to reservation's payment_ids array
    let _ = table_persistence::add_payment_to_reservation(
        &state.db_pool,
        share.reservation_id,
        payment_id,
        Decimal::ZERO, // amount already incremented above
    ).await;

    // Create ticket for the guest
    let reservation = match table_persistence::get_reservation_by_id(&state.db_pool, share.reservation_id).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "Failed to get reservation for ticket creation");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    let ticket_code = generate_ticket_code();
    let ticket_id = Uuid::new_v4();
    match sqlx::query(
        r#"
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL, NOW(), NOW())
        "#
    )
    .bind(ticket_id)
    .bind(reservation.event_id)
    .bind(share.user_id)
    .bind(&ticket_code)
    .bind("table")
    .bind(share.amount)
    .bind("active")
    .execute(&state.db_pool)
    .await
    {
        Ok(_) => {
            info!(ticket_id = %ticket_id, "Created ticket for guest");
            // Link ticket to reservation
            let _ = table_persistence::add_ticket_to_reservation(&state.db_pool, share.reservation_id, ticket_id).await;
        }
        Err(e) => {
            error!(error = %e, "Failed to create ticket for guest");
        }
    }

    // Check if all shares are paid -> confirm reservation
    match table_persistence::check_and_confirm_reservation(&state.db_pool, share.reservation_id).await {
        Ok(_) => info!(reservation_id = %share.reservation_id, "Checked reservation confirmation status"),
        Err(e) => error!(error = %e, "Failed to check reservation confirmation"),
    }

    StatusCode::OK
}

fn generate_ticket_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_part: String = (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 26 { (b'A' + idx) as char } else { (b'0' + (idx - 26)) as char }
        })
        .collect();
    format!("TKT-{}", random_part)
}
