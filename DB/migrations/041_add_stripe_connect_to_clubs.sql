-- Migration 041: Stripe Connect support for club payouts
-- Adds connected-account tracking and configurable platform commissions.

ALTER TABLE clubs
    ADD COLUMN IF NOT EXISTS stripe_connected_account_id VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS platform_commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS platform_commission_fixed_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clubs_stripe_connected_account_id
    ON clubs (stripe_connected_account_id)
    WHERE stripe_connected_account_id IS NOT NULL;
