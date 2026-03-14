-- Migration 029: Support for manual reservations created by club owner
-- Requires discussion with backend colleague before applying

ALTER TABLE table_reservations
    ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN manual_notes TEXT;

COMMENT ON COLUMN table_reservations.is_manual IS 'TRUE when the reservation was created manually by the club owner (e.g. phone call)';
COMMENT ON COLUMN table_reservations.manual_notes IS 'Internal notes from the club owner for manual reservations';
