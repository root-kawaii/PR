-- Migration 044: club-level tables
--
-- Goal: tables become a club-level concept instead of an event-level one.
-- Areas + tables are configured once for the club, every event reuses them.
--
-- Strategy:
-- 1. Make tables.event_id NULLABLE so a table can exist without being bound
--    to a specific event. Existing rows keep their event_id (no data loss).
-- 2. Update the area-default trigger so it tolerates a NULL event_id when
--    area_id is already provided (the common case for new club-level tables).
-- 3. Add a partial unique index on (area_id, name) for club-level tables
--    (event_id IS NULL) to prevent duplicate names within an area.
--
-- Existing reservations keep their table_id and event_id unchanged.

-- 1. Drop NOT NULL on tables.event_id.
ALTER TABLE tables
    ALTER COLUMN event_id DROP NOT NULL;

-- 2. Replace the trigger function so it handles NULL event_id gracefully.
CREATE OR REPLACE FUNCTION ensure_table_area_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_club_id UUID;
    v_area_id UUID;
BEGIN
    IF NEW.area_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.event_id IS NULL THEN
        RAISE EXCEPTION 'Cannot assign default area: table has neither area_id nor event_id';
    END IF;

    SELECT club_id
    INTO v_club_id
    FROM events
    WHERE id = NEW.event_id;

    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Cannot assign default area: event % has no club_id', NEW.event_id;
    END IF;

    SELECT a.id
    INTO v_area_id
    FROM areas a
    WHERE a.club_id = v_club_id
      AND UPPER(TRIM(a.name)) = 'A'
    ORDER BY a.created_at ASC
    LIMIT 1;

    IF v_area_id IS NULL THEN
        INSERT INTO areas (id, club_id, name, price, description)
        VALUES (
            gen_random_uuid(),
            v_club_id,
            'A',
            COALESCE(NEW.min_spend, 0),
            'Default area created automatically'
        )
        RETURNING id INTO v_area_id;
    END IF;

    NEW.area_id := v_area_id;
    RETURN NEW;
END;
$$;

-- 3. Prevent duplicate table names within the same area for club-level tables.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_area_name_unique
    ON tables (area_id, name)
    WHERE event_id IS NULL;
