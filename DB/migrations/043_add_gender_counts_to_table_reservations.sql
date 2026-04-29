ALTER TABLE table_reservations
    ADD COLUMN IF NOT EXISTS male_guest_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS female_guest_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN table_reservations.male_guest_count IS 'Number of male guests associated with the reservation.';
COMMENT ON COLUMN table_reservations.female_guest_count IS 'Number of female guests associated with the reservation.';
