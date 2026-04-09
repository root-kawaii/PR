-- Migration 035: Replace per-guest payment link tokens with a single reservation-level shared link
--
-- Previously each paying guest had their own payment_link_token in reservation_payment_shares.
-- Now a single token is stored on table_reservations. Anyone with the link can claim a slot
-- and pay their share without the owner entering guest phone numbers upfront.

ALTER TABLE table_reservations
    ADD COLUMN IF NOT EXISTS payment_link_token VARCHAR(100) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_reservations_payment_link_token
    ON table_reservations(payment_link_token);

-- The per-share payment_link_token column in reservation_payment_shares is left in place
-- so existing rows remain valid. No new rows will have this column set.
COMMENT ON COLUMN reservation_payment_shares.payment_link_token IS 'Deprecated in migration 035. Use table_reservations.payment_link_token instead.';
