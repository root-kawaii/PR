-- 050_reconcile_stuck_payment_shares.sql
--
-- Reconciliation for the "checkout_pending stuck forever" bug in split
-- payments (reservation_payment_shares).
--
-- Background: when a guest paid via /payment-links/:token, the share row was
-- inserted with status='checkout_pending' and stripe_checkout_session_id=NULL,
-- then the Stripe Checkout Session was created and a follow-up UPDATE wrote
-- the session id on the row. If that follow-up UPDATE failed (or arrived
-- after Stripe's webhook), the webhook could not match the share by
-- stripe_checkout_session_id and silently returned 200 OK without marking the
-- share paid or incrementing num_people. Stripe-side the payment had already
-- succeeded, so the slot was permanently stuck.
--
-- The application code in this PR adds a metadata fallback so new payments
-- cannot get stuck this way again. This migration handles the residue:
--
--   1) Auto-expire shares that never got a checkout session id and are
--      clearly abandoned (older than 24h). These cannot have been paid on
--      Stripe (the customer never reached Stripe).
--   2) Expose a v_stuck_payment_shares view listing shares that DID get a
--      checkout session and are pending for more than 15 minutes. These are
--      candidates for manual reconciliation: an operator looks them up in
--      Stripe and, if the PaymentIntent succeeded, deletes the relevant row
--      from processed_stripe_events and calls `stripe events resend <evt>`
--      so the (patched) webhook handler can complete the work.

BEGIN;

UPDATE reservation_payment_shares
SET    status = 'expired',
       updated_at = NOW()
WHERE  status = 'checkout_pending'
  AND  stripe_checkout_session_id IS NULL
  AND  is_owner = false
  AND  created_at < NOW() - INTERVAL '24 hours';

CREATE OR REPLACE VIEW v_stuck_payment_shares AS
SELECT ps.id                          AS share_id,
       ps.reservation_id,
       ps.phone_number,
       ps.guest_name,
       ps.guest_email,
       ps.amount,
       ps.stripe_checkout_session_id,
       ps.created_at,
       r.event_id,
       e.club_id,
       r.status                       AS reservation_status,
       r.num_people,
       r.amount_paid,
       r.total_amount
FROM   reservation_payment_shares ps
JOIN   table_reservations r ON r.id = ps.reservation_id
JOIN   events e             ON e.id = r.event_id
WHERE  ps.status = 'checkout_pending'
  AND  ps.is_owner = false
  AND  ps.created_at < NOW() - INTERVAL '15 minutes';

COMMENT ON VIEW v_stuck_payment_shares IS
  'Payment shares stuck in checkout_pending for >15 min. Reconcile via Stripe: if PaymentIntent succeeded, DELETE the relevant row from processed_stripe_events and resend the checkout.session.completed event so the webhook re-processes it.';

COMMIT;
