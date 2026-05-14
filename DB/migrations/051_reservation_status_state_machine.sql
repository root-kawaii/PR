DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'reservation_status'
          AND n.nspname = current_schema()
    ) THEN
        CREATE TYPE reservation_status AS ENUM (
            'pending',
            'confirmed',
            'completed',
            'refused',
            'cancelled'
        );
    ELSE
        ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'pending';
        ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'confirmed';
        ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'completed';
        ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'refused';
        ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'cancelled';
    END IF;
END $$;

ALTER TABLE table_reservations
    ADD COLUMN IF NOT EXISTS refusal_reason TEXT;

DROP VIEW IF EXISTS v_stuck_payment_shares;

ALTER TABLE table_reservations
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE table_reservations
    ALTER COLUMN status TYPE reservation_status
    USING status::reservation_status;

ALTER TABLE table_reservations
    ALTER COLUMN status SET DEFAULT 'pending'::reservation_status;

CREATE TABLE IF NOT EXISTS table_reservation_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
    status reservation_status NOT NULL,
    refusal_reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_reservation_status_history_reservation
    ON table_reservation_status_history(reservation_id, changed_at DESC);

CREATE OR REPLACE FUNCTION reservation_status_transition_allowed(
    from_status reservation_status,
    to_status reservation_status
)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN from_status = to_status THEN TRUE
        WHEN from_status = 'pending' THEN to_status IN ('confirmed', 'refused', 'cancelled')
        WHEN from_status = 'confirmed' THEN to_status IN ('pending', 'completed', 'refused', 'cancelled')
        ELSE FALSE
    END;
$$;

CREATE OR REPLACE FUNCTION validate_table_reservation_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status != OLD.status
       AND NOT reservation_status_transition_allowed(OLD.status, NEW.status) THEN
        RAISE EXCEPTION
            'Invalid reservation status transition from % to %',
            OLD.status,
            NEW.status;
    END IF;

    IF NEW.status != 'refused' THEN
        NEW.refusal_reason := NULL;
    ELSIF NEW.refusal_reason IS NOT NULL THEN
        NEW.refusal_reason := NULLIF(BTRIM(NEW.refusal_reason), '');
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_table_reservation_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO table_reservation_status_history (
        reservation_id,
        status,
        refusal_reason,
        changed_at
    )
    VALUES (
        NEW.id,
        NEW.status,
        NEW.refusal_reason,
        COALESCE(NEW.updated_at, NOW())
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_table_reservation_status_transition ON table_reservations;
CREATE TRIGGER trg_validate_table_reservation_status_transition
BEFORE UPDATE OF status, refusal_reason ON table_reservations
FOR EACH ROW
EXECUTE FUNCTION validate_table_reservation_status_transition();

DROP TRIGGER IF EXISTS trg_log_table_reservation_status_insert ON table_reservations;
CREATE TRIGGER trg_log_table_reservation_status_insert
AFTER INSERT ON table_reservations
FOR EACH ROW
EXECUTE FUNCTION log_table_reservation_status_change();

DROP TRIGGER IF EXISTS trg_log_table_reservation_status_update ON table_reservations;
CREATE TRIGGER trg_log_table_reservation_status_update
AFTER UPDATE OF status ON table_reservations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_table_reservation_status_change();

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
  'Payment shares stuck in checkout_pending for >15 min. Reconcile via Stripe: if PaymentIntent succeeded, DELETE the relevant row from processed_stripe_events and resend the checkout.session.completed event so the (patched) webhook handler can complete the work.';

INSERT INTO table_reservation_status_history (reservation_id, status, refusal_reason, changed_at)
SELECT
    tr.id,
    tr.status,
    tr.refusal_reason,
    COALESCE(tr.updated_at, tr.created_at, NOW())
FROM table_reservations tr
WHERE NOT EXISTS (
    SELECT 1
    FROM table_reservation_status_history history
    WHERE history.reservation_id = tr.id
);
