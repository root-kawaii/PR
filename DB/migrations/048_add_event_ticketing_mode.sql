ALTER TABLE events
ADD COLUMN IF NOT EXISTS ticketing_mode TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'events_ticketing_mode_check'
    ) THEN
        ALTER TABLE events
        ADD CONSTRAINT events_ticketing_mode_check
        CHECK (ticketing_mode IN ('none', 'free', 'paid'));
    END IF;
END $$;

UPDATE events
SET ticketing_mode = CASE
    WHEN entry_type = 'ticketed' THEN 'paid'
    ELSE 'none'
END
WHERE ticketing_mode IS NULL;
