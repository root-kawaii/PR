-- Migration 017: Update payments table to support Stripe and multiple users
-- Add stripe_payment_intent_id for Stripe integration
-- Add user_ids array to track all users covered by this payment

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_ids UUID[] DEFAULT '{}';

-- Create index on stripe_payment_intent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent_id ON payments(stripe_payment_intent_id);

-- Create index on user_ids for array queries
CREATE INDEX IF NOT EXISTS idx_payments_user_ids ON payments USING GIN(user_ids);
