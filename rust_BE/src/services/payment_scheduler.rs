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
struct AuthorizedPaymentRow {
    payment_id: Uuid,
    stripe_payment_intent_id: Option<String>,
    stripe_customer_id: Option<String>,
    stripe_payment_method_id: Option<String>,
    amount: rust_decimal::Decimal,
    authorized_at: Option<chrono::NaiveDateTime>,
    event_date: chrono::NaiveDate,
}

/// Starts the daily payment scheduler.
///
/// Every day at 09:00 UTC it:
///   1. Captures authorized payments whose event is tomorrow.
///   2. Re-authorizes payments whose hold is ≥6 days old (Stripe limit is 7 days).
pub async fn run(state: Arc<AppState>) {
    info!("Payment scheduler started");

    loop {
        sleep_until_next_9am().await;
        info!("Payment scheduler woke up — running daily job");
        run_daily_job(&state).await;
    }
}

async fn run_daily_job(state: &Arc<AppState>) {
    let today = Utc::now().date_naive();
    let tomorrow = today + Duration::days(1);
    let reauth_threshold = today - Duration::days(6);

    // Fetch all authorized manual-capture payments that have a real event_date set.
    // Uses query_as instead of query! to avoid compile-time schema validation
    // (migrations may not have run on the connected DB yet).
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
        "#,
    )
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "Scheduler: failed to fetch authorized payments");
            return;
        }
    };

    info!(count = rows.len(), "Scheduler: processing authorized payments");

    for row in rows {
        let payment_id = row.payment_id;
        let event_date = row.event_date;

        if event_date == tomorrow {
            // ── Capture ──────────────────────────────────────────────────────
            info!(payment_id = %payment_id, event_date = %event_date, "Scheduler: capturing payment (event is tomorrow)");
            match capture_payment_service(payment_id, None, None, state).await {
                Ok(_) => info!(payment_id = %payment_id, "Scheduler: payment captured"),
                Err(e) => error!(payment_id = %payment_id, error = ?e, "Scheduler: capture failed"),
            }
        } else if let Some(authorized_at) = row.authorized_at {
            let authorized_date = authorized_at.date();
            if authorized_date <= reauth_threshold {
                // ── Re-authorize ─────────────────────────────────────────────
                info!(payment_id = %payment_id, authorized_at = %authorized_at, "Scheduler: re-authorizing (hold is 6+ days old)");

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
                    error!(payment_id = %payment_id, error = ?e, "Scheduler: re-authorization failed");
                }
            }
        }
    }

    info!("Scheduler: daily job complete");
}

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
