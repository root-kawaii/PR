ALTER TABLE events
ADD COLUMN IF NOT EXISTS entry_type TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'events_entry_type_check'
    ) THEN
        ALTER TABLE events
        ADD CONSTRAINT events_entry_type_check
        CHECK (entry_type IN ('free', 'ticketed'));
    END IF;
END $$;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS has_reservable_areas BOOLEAN;

UPDATE events
SET entry_type = CASE
    WHEN NULLIF(TRIM(COALESCE(price, '')), '') IS NULL THEN 'free'
    WHEN REGEXP_REPLACE(TRIM(COALESCE(price, '')), '[^0-9,.-]', '', 'g') ~ '^-?0*([.,]0+)?$' THEN 'free'
    ELSE 'ticketed'
END
WHERE entry_type IS NULL;

UPDATE events e
SET has_reservable_areas = EXISTS (
    SELECT 1
    FROM tables t
    LEFT JOIN areas a ON a.id = t.area_id
    WHERE (
            t.event_id = e.id
            AND t.available = true
        )
       OR (
            t.event_id IS NULL
            AND t.available = true
            AND e.club_id IS NOT NULL
            AND a.club_id = e.club_id
       )
)
WHERE has_reservable_areas IS NULL;
