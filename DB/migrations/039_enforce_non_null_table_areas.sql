-- Migration 039: Enforce non-null table areas with default "A" fallback
--
-- Goals:
-- 1. Backfill existing tables with no area_id
-- 2. Create or reuse a default area named "A" per club
-- 3. Add a DB-level trigger so future inserts/updates never leave area_id null
-- 4. Enforce NOT NULL on tables.area_id

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM tables t
        JOIN events e ON e.id = t.event_id
        WHERE t.area_id IS NULL
          AND e.club_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot enforce non-null table areas: some tables belong to events without club_id';
    END IF;
END $$;

-- Create a default "A" area for clubs that still have null-area tables.
WITH clubs_needing_default AS (
    SELECT
        e.club_id,
        MIN(t.min_spend) AS default_price
    FROM tables t
    JOIN events e ON e.id = t.event_id
    WHERE t.area_id IS NULL
      AND e.club_id IS NOT NULL
    GROUP BY e.club_id
)
INSERT INTO areas (id, club_id, name, price, description)
SELECT
    gen_random_uuid(),
    c.club_id,
    'A',
    c.default_price,
    'Default area created automatically'
FROM clubs_needing_default c
WHERE NOT EXISTS (
    SELECT 1
    FROM areas a
    WHERE a.club_id = c.club_id
      AND UPPER(TRIM(a.name)) = 'A'
);

-- Backfill all existing null-area tables using the club's "A" area.
UPDATE tables t
SET area_id = default_area.id,
    updated_at = NOW()
FROM events e
JOIN LATERAL (
    SELECT a.id
    FROM areas a
    WHERE a.club_id = e.club_id
      AND UPPER(TRIM(a.name)) = 'A'
    ORDER BY a.created_at ASC
    LIMIT 1
) AS default_area ON TRUE
WHERE t.event_id = e.id
  AND t.area_id IS NULL;

-- Ensure future writes always get a default area instead of null.
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

DROP TRIGGER IF EXISTS trg_tables_ensure_area_default ON tables;

CREATE TRIGGER trg_tables_ensure_area_default
BEFORE INSERT OR UPDATE OF area_id, event_id, min_spend
ON tables
FOR EACH ROW
EXECUTE FUNCTION ensure_table_area_default();

ALTER TABLE tables
    DROP CONSTRAINT IF EXISTS tables_area_id_fkey;

ALTER TABLE tables
    ALTER COLUMN area_id SET NOT NULL;

ALTER TABLE tables
    ADD CONSTRAINT tables_area_id_fkey
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE RESTRICT;
