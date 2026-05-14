-- Drop the legacy `zone` column from `tables`. It was a free-text label
-- that predated the `areas` table and is now fully replaced by the
-- `area_id` → `areas.name` relationship. Dashboard forms, mobile UI and
-- backend models have been updated to read the area name everywhere.
ALTER TABLE tables
DROP COLUMN IF EXISTS zone;
