use crate::models::{AppState, PaymentStatus};
use crate::application::outbox_service;
use crate::application::reservation_service as table_persistence;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    body::Bytes,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::sync::Arc;
use uuid::Uuid;
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

    // Verify HMAC-SHA256 signature — always enforced, no bypass
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

    // Parse JSON event payload
    let event: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            error!(error = %e, "Failed to parse webhook payload");
            return StatusCode::BAD_REQUEST;
        }
    };

    let event_type = event["type"].as_str().unwrap_or("");
    let stripe_event_id = event["id"].as_str().unwrap_or("");
    let payment_intent_id = event["data"]["object"]["id"].as_str().unwrap_or("");

    info!(event_type = %event_type, stripe_event_id = %stripe_event_id, payment_intent_id = %payment_intent_id, "Received Stripe webhook");

    // Deduplication — ignore already-processed events (Stripe retries on non-200)
    if !stripe_event_id.is_empty() {
        match sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM processed_stripe_events WHERE stripe_event_id = $1)"
        )
        .bind(stripe_event_id)
        .fetch_one(&state.db_pool)
        .await
        {
            Ok(true) => {
                info!(stripe_event_id = %stripe_event_id, "Duplicate Stripe event — already processed");
                return StatusCode::OK;
            }
            Ok(false) => {}
            Err(e) => {
                error!(error = %e, "Failed to check event deduplication");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }

        // Mark event as processed before handling so concurrent retries are rejected
        if let Err(e) = sqlx::query(
            "INSERT INTO processed_stripe_events (stripe_event_id, event_type, processed_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING"
        )
        .bind(stripe_event_id)
        .bind(event_type)
        .execute(&state.db_pool)
        .await
        {
            error!(error = %e, "Failed to record Stripe event as processed");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }

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

/// Handle checkout.session.completed webhook for guest split payments.
/// All DB writes run inside a single transaction — if any step fails the whole
/// batch is rolled back, preventing partial state (e.g. payment created but
/// reservation amount_paid not incremented).
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
    let payment_id = Uuid::new_v4();
    let sender_id = share.user_id.unwrap_or_else(Uuid::nil);

    // Fetch the reservation before starting the transaction (read-only)
    let reservation = match table_persistence::get_reservation_by_id(&state.db_pool, share.reservation_id).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "Failed to get reservation for ticket creation");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    // Begin transaction — all writes are atomic
    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            error!(error = %e, "Failed to begin transaction for checkout completion");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };

    // 1. Create payment record
    if let Err(e) = sqlx::query(
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
    .execute(&mut *tx)
    .await
    {
        error!(error = %e, "Failed to create payment record for guest");
        let _ = tx.rollback().await;
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    info!(payment_id = %payment_id, "Created payment record for guest");

    // 2. Mark payment share as paid
    let stripe_pi_opt = if stripe_pi_id.is_empty() { None } else { Some(stripe_pi_id.clone()) };
    if let Err(e) = sqlx::query(
        r#"UPDATE reservation_payment_shares
           SET status = 'paid',
               payment_id = $1,
               stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
               updated_at = NOW()
           WHERE id = $3"#
    )
    .bind(payment_id)
    .bind(&stripe_pi_opt)
    .bind(share.id)
    .execute(&mut *tx)
    .await
    {
        error!(error = %e, share_id = %share.id, "Failed to update payment share");
        let _ = tx.rollback().await;
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    info!(share_id = %share.id, "Payment share marked as paid");

    // 3. Increment reservation amount_paid and num_people (one new guest paid)
    if let Err(e) = sqlx::query(
        "UPDATE table_reservations SET amount_paid = amount_paid + $1, num_people = num_people + 1, updated_at = NOW() WHERE id = $2"
    )
    .bind(share.amount)
    .bind(share.reservation_id)
    .execute(&mut *tx)
    .await
    {
        error!(error = %e, "Failed to update reservation amount_paid and num_people");
        let _ = tx.rollback().await;
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    info!(reservation_id = %share.reservation_id, amount = %share.amount, "Reservation amount_paid and num_people updated");

    // 4. Add payment ID to reservation's payment_ids array
    let _ = sqlx::query(
        "UPDATE table_reservations SET payment_ids = array_append(payment_ids, $1) WHERE id = $2"
    )
    .bind(payment_id)
    .bind(share.reservation_id)
    .execute(&mut *tx)
    .await;

    // 5. Create ticket for the guest
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
    .execute(&mut *tx)
    .await
    {
        Ok(_) => {
            info!(ticket_id = %ticket_id, "Created ticket for guest");
            let _ = sqlx::query(
                "UPDATE table_reservations SET ticket_ids = array_append(ticket_ids, $1) WHERE id = $2"
            )
            .bind(ticket_id)
            .bind(share.reservation_id)
            .execute(&mut *tx)
            .await;
        }
        Err(e) => {
            error!(error = %e, "Failed to create ticket for guest");
        }
    }

    // 6. Auto-confirm the reservation once amount_paid >= total_amount
    if let Err(e) = sqlx::query(
        r#"UPDATE table_reservations SET status = 'confirmed', updated_at = NOW()
           WHERE id = $1
             AND status != 'confirmed'
             AND amount_paid >= total_amount"#
    )
    .bind(share.reservation_id)
    .execute(&mut *tx)
    .await
    {
        error!(error = %e, "Failed to check reservation confirmation");
    }

    // Commit everything atomically
    if let Err(e) = tx.commit().await {
        error!(error = %e, "Failed to commit checkout completion transaction");
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    info!(reservation_id = %share.reservation_id, "Checkout completion transaction committed");

    // Check final reservation status (for push notification — outside transaction)
    let reservation_status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM table_reservations WHERE id = $1"
    )
    .bind(share.reservation_id)
    .fetch_optional(&state.db_pool)
    .await
    .ok()
    .flatten();

    if let Ok(push_token) = sqlx::query_scalar::<_, Option<String>>(
        "SELECT expo_push_token FROM users WHERE id = $1"
    )
    .bind(reservation.user_id)
    .fetch_one(&state.db_pool)
    .await
    {
        if let Some(token) = push_token {
            let guest_name = share.guest_name.as_deref().unwrap_or("Un ospite");
            let all_confirmed = reservation_status.as_deref() == Some("confirmed");
            let (title, body) = if all_confirmed {
                (
                    "Prenotazione confermata!".to_string(),
                    "Tutti gli ospiti hanno pagato. La tua prenotazione è confermata.".to_string(),
                )
            } else {
                (
                    "Pagamento ricevuto".to_string(),
                    format!("{} ha pagato la sua parte.", guest_name),
                )
            };
            let _ = outbox_service::enqueue_push_notification(
                &state.db_pool,
                &token,
                &title,
                &body,
                Some("reservation"),
                Some(share.reservation_id),
            ).await;
        }
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
