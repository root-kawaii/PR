-- Migration 028: Add Stripe customer and payment method tracking to payments
-- Purpose: Enables off-session re-authorization when the 7-day Stripe hold expires

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_stripe_customer ON payments(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
