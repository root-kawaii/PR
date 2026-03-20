use std::sync::Arc;
use chrono::{Duration, Utc};
use tokio::time::sleep;
use tracing::{error, info, warn};
use uuid::Uuid;

use stripe::{
    CreatePaymentIntent, Currency, PaymentIntent, PaymentIntentCaptureMethod,
    PaymentIntentOffSession,
};

use crate::models::AppState;
use crate::persistences::payment_persistence::capture_payment_service;

// Row returned by the scheduler query
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct AuthorizedPaymentRow {
    payment_id: Uuid,
    stripe_payment_intent_id: Option<String>,
    stripe_customer_id: Option<String>,
    stripe_payment_method_id: Option<String>,
    amount: rust_decimal::Decimal,
    authorized_at: Option<chrono::NaiveDateTime>,
    event_date: chrono::NaiveDate,
}

// Row for reconciliation query
#[derive(sqlx::FromRow)]
struct StaleCheckoutShare {
    share_id: Uuid,
    reservation_id: Uuid,
    user_id: Option<Uuid>,
    amount: rust_decimal::Decimal,
    stripe_checkout_session_id: String,
}

// Row for expired share query
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct ExpiredShareRow {
    share_id: Uuid,
    reservation_id: Uuid,
    phone_number: Option<String>,
    amount: rust_decimal::Decimal,
    owner_user_id: Uuid,
    owner_contact_name: String,
    event_name: String,
    table_name: String,
}

/// Starts the payment scheduler.
///
/// Two loops run concurrently:
///   - **Frequent (every 30 min):** capture + reconciliation — only runs when
///     there are active payments/stale shares, so it's a no-op most of the time.
///   - **Daily (09:00 UTC):** re-authorization + payment share expiry.
pub async fn run(state: Arc<AppState>) {
    info!("Payment scheduler started");

    let frequent_state = Arc::clone(&state);
    let daily_state = Arc::clone(&state);

    tokio::join!(
        run_frequent_loop(frequent_state),
        run_daily_loop(daily_state),
    );
}

/// Runs capture + reconciliation every 30 minutes.
async fn run_frequent_loop(state: Arc<AppState>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30 * 60));

    loop {
        interval.tick().await;

        let today = Utc::now().date_naive();
        let tomorrow = today + Duration::days(1);

        // Only capture (no re-auth — that's daily)
        run_capture(&state, tomorrow).await;

        // Reconcile stale checkout sessions
        run_checkout_reconciliation(&state).await;

        info!("Scheduler: frequent job complete");
    }
}

/// Runs re-authorization + share expiry once a day at 09:00 UTC.
async fn run_daily_loop(state: Arc<AppState>) {
    loop {
        sleep_until_next_9am().await;

        let today = Utc::now().date_naive();
        let reauth_threshold = today - Duration::days(6);

        info!("Scheduler: running daily job (re-auth + expiry)");

        // Re-authorize holds about to expire
        run_reauth(&state, reauth_threshold).await;

        // Expire stale payment shares
        run_payment_share_expiry(&state).await;

        info!("Scheduler: daily job complete");
    }
}

// ============================================================================
// 1. Capture (runs every 30 min)
// ============================================================================

async fn run_capture(state: &Arc<AppState>, tomorrow: chrono::NaiveDate) {
    let rows: Vec<AuthorizedPaymentRow> = match sqlx::query_as(
        r#"
        SELECT
            p.id                        AS payment_id,
            p.stripe_payment_intent_id,
            p.stripe_customer_id,
            p.stripe_payment_method_id,
            p.amount,
            p.authorized_at,
            e.event_date
        FROM payments p
        JOIN table_reservations tr ON p.id = ANY(tr.payment_ids)
        JOIN events e ON e.id = tr.event_id
        WHERE p.authorization_status = 'authorized'
          AND p.capture_method       = 'manual'
          AND e.event_date IS NOT NULL
          AND e.event_date = $1
        "#,
    )
    .bind(tomorrow)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("Scheduler: failed to fetch payments to capture: {e}");
            error!("{}", msg);
            send_alert(state, &msg).await;
            return;
        }
    };

    if rows.is_empty() {
        return;
    }

    info!(count = rows.len(), "Scheduler: capturing payments (event is tomorrow)");

    for row in rows {
        let payment_id = row.payment_id;
        info!(payment_id = %payment_id, event_date = %row.event_date, "Scheduler: capturing payment");
        match capture_payment_service(payment_id, None, None, state).await {
            Ok(_) => info!(payment_id = %payment_id, "Scheduler: payment captured"),
            Err(e) => {
                let msg = format!("Scheduler: capture FAILED for payment {payment_id}: {e:?}");
                error!("{}", msg);
                send_alert(state, &msg).await;
            }
        }
    }
}

// ============================================================================
// 2. Re-authorize (runs daily at 9am)
// ============================================================================

async fn run_reauth(state: &Arc<AppState>, reauth_threshold: chrono::NaiveDate) {
    let rows: Vec<AuthorizedPaymentRow> = match sqlx::query_as(
        r#"
        SELECT
            p.id                        AS payment_id,
            p.stripe_payment_intent_id,
            p.stripe_customer_id,
            p.stripe_payment_method_id,
            p.amount,
            p.authorized_at,
            e.event_date
        FROM payments p
        JOIN table_reservations tr ON p.id = ANY(tr.payment_ids)
        JOIN events e ON e.id = tr.event_id
        WHERE p.authorization_status = 'authorized'
          AND p.capture_method       = 'manual'
          AND e.event_date IS NOT NULL
          AND p.authorized_at IS NOT NULL
          AND p.authorized_at::date <= $1
        "#,
    )
    .bind(reauth_threshold)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("Scheduler: failed to fetch payments to re-authorize: {e}");
            error!("{}", msg);
            send_alert(state, &msg).await;
            return;
        }
    };

    if rows.is_empty() {
        return;
    }

    info!(count = rows.len(), "Scheduler: re-authorizing payments (hold 6+ days old)");

    for row in rows {
        let payment_id = row.payment_id;

        let stripe_pi_id = match row.stripe_payment_intent_id {
            Some(id) => id,
            None => {
                warn!(payment_id = %payment_id, "Scheduler: missing stripe_payment_intent_id, skipping");
                continue;
            }
        };
        let customer_id = match row.stripe_customer_id {
            Some(id) => id,
            None => {
                warn!(payment_id = %payment_id, "Scheduler: missing stripe_customer_id, skipping re-auth");
                continue;
            }
        };
        let payment_method_id = match row.stripe_payment_method_id {
            Some(id) => id,
            None => {
                warn!(payment_id = %payment_id, "Scheduler: missing stripe_payment_method_id, skipping re-auth");
                continue;
            }
        };

        info!(payment_id = %payment_id, "Scheduler: re-authorizing");

        if let Err(e) = reauthorize(
            state,
            payment_id,
            &stripe_pi_id,
            &customer_id,
            &payment_method_id,
            row.amount,
        )
        .await
        {
            let msg = format!("Scheduler: re-authorization FAILED for payment {payment_id}: {e}");
            error!("{}", msg);
            send_alert(state, &msg).await;
        }
    }
}

// ============================================================================
// 3. Webhook reconciliation
// ============================================================================

/// Finds payment shares that have a checkout session ID but are still pending
/// (meaning the webhook may have failed), then checks Stripe for the real status.
async fn run_checkout_reconciliation(state: &Arc<AppState>) {
    // Shares that have a checkout session but are still pending after 30 min
    let stale_shares: Vec<StaleCheckoutShare> = match sqlx::query_as(
        r#"
        SELECT
            rps.id                          AS share_id,
            rps.reservation_id,
            rps.user_id,
            rps.amount,
            rps.stripe_checkout_session_id
        FROM reservation_payment_shares rps
        WHERE rps.status = 'pending'
          AND rps.stripe_checkout_session_id IS NOT NULL
          AND rps.updated_at < NOW() - INTERVAL '30 minutes'
        "#,
    )
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            error!(error = %e, "Reconciliation: failed to fetch stale checkout shares");
            return;
        }
    };

    if stale_shares.is_empty() {
        info!("Reconciliation: no stale checkout sessions found");
        return;
    }

    info!(count = stale_shares.len(), "Reconciliation: checking stale checkout sessions against Stripe");

    for share in stale_shares {
        let session_id: stripe::CheckoutSessionId = match share.stripe_checkout_session_id.parse() {
            Ok(id) => id,
            Err(_) => {
                warn!(share_id = %share.share_id, "Reconciliation: invalid checkout session ID, skipping");
                continue;
            }
        };

        let session = match stripe::CheckoutSession::retrieve(&state.stripe_client, &session_id, &[]).await {
            Ok(s) => s,
            Err(e) => {
                warn!(share_id = %share.share_id, error = %e, "Reconciliation: failed to retrieve checkout session from Stripe");
                continue;
            }
        };

        // Only reconcile if Stripe says the session is actually paid/complete
        let status_str = format!("{:?}", session.status);
        if !status_str.to_lowercase().contains("complete") {
            info!(share_id = %share.share_id, status = %status_str, "Reconciliation: session not complete, skipping");
            continue;
        }

        info!(share_id = %share.share_id, "Reconciliation: session is complete on Stripe — reconciling");

        // Extract the payment intent ID from the session
        let stripe_pi_id = session.payment_intent
            .map(|pi| match pi {
                stripe::Expandable::Id(id) => id.to_string(),
                stripe::Expandable::Object(obj) => obj.id.to_string(),
            })
            .unwrap_or_default();

        let now = chrono::Utc::now().naive_utc();

        // Create payment record for this guest
        let payment_id = Uuid::new_v4();
        let sender_id = share.user_id.unwrap_or_else(Uuid::nil);

        if let Err(e) = sqlx::query(
            r#"
            INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids)
            VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $8)
            ON CONFLICT (stripe_payment_intent_id) DO NOTHING
            "#,
        )
        .bind(payment_id)
        .bind(sender_id)
        .bind(sender_id)
        .bind(share.amount)
        .bind(now)
        .bind(now)
        .bind(&stripe_pi_id)
        .bind(&vec![sender_id])
        .execute(&state.db_pool)
        .await
        {
            error!(share_id = %share.share_id, error = %e, "Reconciliation: failed to create payment record");
            send_alert(state, &format!("Reconciliation: failed to create payment for share {}: {e}", share.share_id)).await;
            continue;
        }

        // Mark share as paid
        if let Err(e) = sqlx::query(
            "UPDATE reservation_payment_shares SET status = 'paid', payment_id = $1, stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id), updated_at = NOW() WHERE id = $3 AND status = 'pending'"
        )
        .bind(payment_id)
        .bind(if stripe_pi_id.is_empty() { None } else { Some(&stripe_pi_id) })
        .bind(share.share_id)
        .execute(&state.db_pool)
        .await
        {
            error!(share_id = %share.share_id, error = %e, "Reconciliation: failed to update share status");
            continue;
        }

        // Update reservation amount_paid
        let _ = sqlx::query(
            "UPDATE table_reservations SET amount_paid = amount_paid + $1, payment_ids = array_append(COALESCE(payment_ids, '{}'), $2), updated_at = NOW() WHERE id = $3"
        )
        .bind(share.amount)
        .bind(payment_id)
        .bind(share.reservation_id)
        .execute(&state.db_pool)
        .await;

        // Create ticket for guest
        if let Ok(reservation) = sqlx::query_scalar::<_, Uuid>(
            "SELECT event_id FROM table_reservations WHERE id = $1"
        )
        .bind(share.reservation_id)
        .fetch_one(&state.db_pool)
        .await
        {
            let ticket_id = Uuid::new_v4();
            let ticket_code = generate_ticket_code();
            let _ = sqlx::query(
                r#"
                INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'table', $5, 'active', NOW(), NULL, NOW(), NOW())
                "#,
            )
            .bind(ticket_id)
            .bind(reservation)
            .bind(share.user_id)
            .bind(&ticket_code)
            .bind(share.amount)
            .execute(&state.db_pool)
            .await;

            let _ = sqlx::query(
                "UPDATE table_reservations SET ticket_ids = array_append(COALESCE(ticket_ids, '{}'), $1), updated_at = NOW() WHERE id = $2"
            )
            .bind(ticket_id)
            .bind(share.reservation_id)
            .execute(&state.db_pool)
            .await;
        }

        // Check if all shares paid -> confirm reservation
        let _ = crate::persistences::table_persistence::check_and_confirm_reservation(
            &state.db_pool,
            share.reservation_id,
        )
        .await;

        info!(share_id = %share.share_id, payment_id = %payment_id, "Reconciliation: share reconciled successfully");
        send_alert(state, &format!("Reconciliation: recovered missed payment for share {}", share.share_id)).await;
    }
}

// ============================================================================
// 4. Payment share expiry
// ============================================================================

/// Expires pending payment shares that have been waiting longer than the
/// configured TTL, and alerts the reservation owner.
async fn run_payment_share_expiry(state: &Arc<AppState>) {
    let ttl_hours = state.payment_share_ttl_hours;

    let expired: Vec<ExpiredShareRow> = match sqlx::query_as(
        r#"
        SELECT
            rps.id                  AS share_id,
            rps.reservation_id,
            rps.phone_number,
            rps.amount,
            tr.user_id              AS owner_user_id,
            tr.contact_name         AS owner_contact_name,
            e.name                  AS event_name,
            t.name                  AS table_name
        FROM reservation_payment_shares rps
        JOIN table_reservations tr ON tr.id = rps.reservation_id
        JOIN events e ON e.id = tr.event_id
        JOIN tables t ON t.id = tr.table_id
        WHERE rps.status = 'pending'
          AND rps.is_owner = false
          AND rps.created_at < NOW() - ($1 || ' hours')::INTERVAL
        "#,
    )
    .bind(ttl_hours)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            error!(error = %e, "Share expiry: failed to fetch expired shares");
            return;
        }
    };

    if expired.is_empty() {
        info!("Share expiry: no expired shares");
        return;
    }

    info!(count = expired.len(), ttl_hours = ttl_hours, "Share expiry: processing expired payment shares");

    for share in &expired {
        // Mark share as expired
        if let Err(e) = sqlx::query(
            "UPDATE reservation_payment_shares SET status = 'expired', updated_at = NOW() WHERE id = $1 AND status = 'pending'"
        )
        .bind(share.share_id)
        .execute(&state.db_pool)
        .await
        {
            error!(share_id = %share.share_id, error = %e, "Share expiry: failed to expire share");
            continue;
        }

        let guest_phone = share.phone_number.as_deref().unwrap_or("unknown");
        info!(
            share_id = %share.share_id,
            guest_phone = %guest_phone,
            reservation_id = %share.reservation_id,
            "Share expiry: payment share expired"
        );

        let msg = format!(
            "Payment share expired: guest {} did not pay {:.2}€ for {} at {} (reservation {}). Owner: {}",
            guest_phone, share.amount, share.event_name, share.table_name,
            share.reservation_id, share.owner_contact_name,
        );
        send_alert(state, &msg).await;
    }
}

// ============================================================================
// Alerting
// ============================================================================

/// Sends an alert message to the configured Discord/Slack webhook.
/// Silently does nothing if no webhook URL is configured.
async fn send_alert(state: &AppState, message: &str) {
    let url = match &state.alert_webhook_url {
        Some(u) if !u.is_empty() => u.clone(),
        _ => return,
    };

    // Discord and Slack both accept {"content": "..."} / {"text": "..."}
    // We send both keys so it works with either platform.
    let payload = serde_json::json!({
        "content": message,
        "text": message,
    });

    let client = reqwest::Client::new();
    match client.post(&url).json(&payload).send().await {
        Ok(resp) if resp.status().is_success() => {
            info!("Alert sent successfully");
        }
        Ok(resp) => {
            warn!(status = %resp.status(), "Alert webhook returned non-success status");
        }
        Err(e) => {
            error!(error = %e, "Failed to send alert webhook");
        }
    }
}

// ============================================================================
// Re-authorization (existing logic)
// ============================================================================

/// Cancels the old PaymentIntent and creates + confirms a new one off-session.
async fn reauthorize(
    state: &AppState,
    payment_id: Uuid,
    old_stripe_pi_id: &str,
    customer_id: &str,
    payment_method_id: &str,
    amount: rust_decimal::Decimal,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use rust_decimal::prelude::ToPrimitive;

    // 1. Cancel old PaymentIntent on Stripe
    let old_pi_id: stripe::PaymentIntentId = old_stripe_pi_id.parse()?;
    PaymentIntent::cancel(
        &state.stripe_client,
        &old_pi_id,
        stripe::CancelPaymentIntent::default(),
    )
    .await?;
    info!(old_stripe_pi_id = %old_stripe_pi_id, "Scheduler: old PaymentIntent cancelled");

    // 2. Create new PaymentIntent and confirm it off-session
    let amount_cents = (amount.to_f64().unwrap_or(0.0) * 100.0) as i64;
    let mut params = CreatePaymentIntent::new(amount_cents, Currency::EUR);
    params.capture_method = Some(PaymentIntentCaptureMethod::Manual);
    params.customer = Some(customer_id.parse()?);
    params.payment_method = Some(payment_method_id.parse()?);
    params.confirm = Some(true);
    params.off_session = Some(PaymentIntentOffSession::exists(true));

    let new_pi = PaymentIntent::create(&state.stripe_client, params).await?;
    info!(new_stripe_pi_id = %new_pi.id, "Scheduler: new PaymentIntent created off-session");

    // 3. Update the payment record with the new PI id and reset authorized_at
    sqlx::query(
        r#"
        UPDATE payments
        SET stripe_payment_intent_id = $1,
            authorized_at            = NOW(),
            authorization_status     = 'authorized',
            update_date              = NOW()
        WHERE id = $2
        "#,
    )
    .bind(new_pi.id.to_string())
    .bind(payment_id)
    .execute(&state.db_pool)
    .await?;

    info!(payment_id = %payment_id, new_stripe_pi_id = %new_pi.id, "Scheduler: re-authorization complete");
    Ok(())
}

// ============================================================================
// Helpers
// ============================================================================

/// Sleeps until the next 09:00 UTC.
async fn sleep_until_next_9am() {
    let now = Utc::now();
    let today_9am = now
        .date_naive()
        .and_hms_opt(9, 0, 0)
        .unwrap()
        .and_utc();

    let next_9am = if now < today_9am {
        today_9am
    } else {
        (now.date_naive() + Duration::days(1))
            .and_hms_opt(9, 0, 0)
            .unwrap()
            .and_utc()
    };

    let wait = (next_9am - now)
        .to_std()
        .unwrap_or(std::time::Duration::from_secs(0));

    info!(
        next_run = %next_9am,
        wait_secs = wait.as_secs(),
        "Scheduler: sleeping until next run"
    );
    sleep(wait).await;
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
