# Delayed Capture Payment Plan

Authorize cards at booking time, capture the day before the event. Re-authorize every 6 days to avoid Stripe's 7-day expiry limit.

---

## How it works

```
User books table
  → PaymentIntent created with capture_method: manual + setup_future_usage: off_session
  → Card is authorized (hold placed), NOT charged
  → stripe_customer_id + stripe_payment_method_id saved on payment record

Daily job (runs every morning):
  For each payment with authorization_status = 'authorized':

    IF event is tomorrow:
      → Capture the PaymentIntent → money taken

    ELSE IF authorized_at <= now - 6 days (about to expire):
      → Cancel old PaymentIntent
      → Create new PaymentIntent (capture_method: manual)
      → Confirm off-session with saved customer + payment method
      → Update payment record with new stripe_payment_intent_id, reset authorized_at
```

---

## Current state

| What | Status |
|------|--------|
| `authorized_at` column on payments | ✅ exists |
| `capture_method` column on payments | ✅ exists |
| `cancel_payment_internal` | ✅ exists |
| `capture_payment_internal` | ✅ exists |
| `create_authorized_payment_internal` | ✅ exists |
| `stripe_customer_id` on payment | ❌ missing |
| `stripe_payment_method_id` on payment | ❌ missing |
| Save payment method at booking time | ❌ missing |
| Webhook stores payment_method_id after confirm | ❌ missing |
| Daily job | ❌ missing |

---

## Implementation steps

### Step 1 — DB migration

Add two columns to the `payments` table:

```sql
ALTER TABLE payments
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN stripe_payment_method_id TEXT;
```

File: `DB/migrations/039_add_stripe_customer_to_payments.sql`

---

### Step 2 — Save payment method at booking time

In `table_controller.rs` → `create_payment_intent`:

1. Look up the user's `stripe_customer_id` from the DB (or create a new Stripe Customer if they don't have one yet)
2. Add to the PaymentIntent params:
   - `customer: stripe_customer_id`
   - `setup_future_usage: OffSession` → tells Stripe to save the card for future off-session use
   - `capture_method: Manual`
3. Store `stripe_customer_id` on the payment record

```rust
params.customer = Some(customer_id);
params.setup_future_usage = Some(PaymentIntentSetupFutureUsage::OffSession);
params.capture_method = Some(PaymentIntentCaptureMethod::Manual);
```

---

### Step 3 — Store payment_method_id via webhook

In `webhook_controller.rs` → `handle_stripe_webhook`:

Handle the `payment_intent.succeeded` event (already partially handled) to also extract and store `payment_method_id`:

```
event["data"]["object"]["payment_method"] → store on payments.stripe_payment_method_id
```

This fires after the user completes the payment on the frontend.

---

### Step 4 — The daily job

New file: `rust_BE/src/services/payment_scheduler.rs`

Spawn as a Tokio background task in `main.rs`.

**Logic:**

```rust
// Run once per day at 9am
loop {
    sleep_until_9am().await;

    // Fetch all authorized manual-capture payments
    let payments = query(
        "SELECT p.*, tr.event_id, e.date as event_date
         FROM payments p
         JOIN table_reservations tr ON tr.payment_ids @> ARRAY[p.id]
         JOIN events e ON e.id = tr.event_id
         WHERE p.authorization_status = 'authorized'
           AND p.capture_method = 'manual'"
    ).await;

    for payment in payments {
        let days_since_auth = (now - payment.authorized_at).num_days();
        let days_until_event = (payment.event_date - today).num_days();

        if days_until_event == 1 {
            // Capture — event is tomorrow
            capture_payment_internal(payment.id, None, &state).await;

        } else if days_since_auth >= 6 {
            // Refresh authorization — about to expire
            cancel_payment_internal(payment.id, &state).await;

            // Create new PaymentIntent off-session
            let new_pi = PaymentIntent::create(&stripe_client, CreatePaymentIntent {
                amount: payment.amount_cents,
                currency: EUR,
                customer: payment.stripe_customer_id,
                payment_method: payment.stripe_payment_method_id,
                capture_method: Manual,
                confirm: true,
                off_session: true,
            }).await;

            // Update payment record with new PI id and reset authorized_at
            update_payment_stripe_id(payment.id, new_pi.id, now).await;
        }
    }
}
```

---

## Edge cases to handle

- **User cancels reservation before capture**: cancel the PaymentIntent, no charge
- **Re-authorization fails** (card declined off-session): mark payment as `failed`, notify club owner, flag reservation
- **Event cancelled**: cancel all authorized PaymentIntents for that event
- **Partial capture**: already supported by `capture_payment_service` via `amount_to_capture`
- **Stripe Customer already exists**: store `stripe_customer_id` on the `users` table to avoid creating duplicates

---

## Files to create/modify

| File | Change |
|------|--------|
| `DB/migrations/039_add_stripe_customer_to_payments.sql` | New migration |
| `rust_BE/src/controllers/table_controller.rs` | Add customer + setup_future_usage to create_payment_intent |
| `rust_BE/src/controllers/webhook_controller.rs` | Store payment_method_id on payment_intent.succeeded |
| `rust_BE/src/models/payment.rs` | Add stripe_customer_id, stripe_payment_method_id fields |
| `rust_BE/src/persistences/payment_persistence.rs` | Update queries + add refresh function |
| `rust_BE/src/services/payment_scheduler.rs` | New file — daily job |
| `rust_BE/src/main.rs` | Spawn scheduler as background task |
