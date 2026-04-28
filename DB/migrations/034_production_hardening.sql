-- Migration 034: Production hardening
-- Addresses two audit findings:
--   Issue 10: Webhook deduplication — processed_stripe_events table
--   Issue 16: Missing indexes on Stripe ID columns (full-table scan on every webhook)

-- ============================================================
-- Issue 10: Webhook deduplication
-- ============================================================
-- Stores every Stripe event ID we have processed.
-- The webhook handler inserts here before processing; duplicate events
-- are rejected with 200 OK before any DB writes occur.

CREATE TABLE IF NOT EXISTS processed_stripe_events (
    stripe_event_id  TEXT        PRIMARY KEY,
    event_type       TEXT        NOT NULL,
    processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-prune events older than 30 days (Stripe retries window is ~72h)
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
    ON processed_stripe_events (processed_at);

-- ============================================================
-- Issue 16: Missing indexes on Stripe ID lookup columns
-- ============================================================

-- Payments table: used by update_payment_status webhook handler
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id
    ON payments (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

-- Reservation payment shares: used by checkout.session.completed handler
CREATE INDEX IF NOT EXISTS idx_reservation_payment_shares_stripe_checkout_session_id
    ON reservation_payment_shares (stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;

-- Also index payment_link_token for the verify/checkout endpoints
CREATE INDEX IF NOT EXISTS idx_reservation_payment_shares_payment_link_token
    ON reservation_payment_shares (payment_link_token)
    WHERE payment_link_token IS NOT NULL;
