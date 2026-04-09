-- Migration 036: Prevent the same phone number from paying twice for the same reservation.
-- Uses a partial unique index so it only applies to active (paid/checkout_pending)
-- non-owner shares with a non-null phone — cancelled/expired rows are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_shares_reservation_phone_active
    ON reservation_payment_shares (reservation_id, phone_number)
    WHERE phone_number IS NOT NULL
      AND is_owner = false
      AND status IN ('paid', 'checkout_pending');
