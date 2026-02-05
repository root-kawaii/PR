use crate::models::{AppState, PaymentStatus};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    body::Bytes,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::sync::Arc;
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
        _ => {
            info!(event_type = %event_type, "Unhandled Stripe webhook event type");
            StatusCode::OK
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
