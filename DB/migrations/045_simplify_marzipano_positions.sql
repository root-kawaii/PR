-- Migration 044: make marzipano_config the single source of truth for hotspot positions.
-- Drop the redundant marzipano_position columns from tables and areas.

-- Step A: best-effort backfill — for any table whose position is in marzipano_position
-- but not yet represented as a hotspot inside the event's marzipano_config, inject it.
-- This is a safety net; in practice both were written together by the same handler.
UPDATE events e
SET marzipano_config = (
  SELECT jsonb_agg(
    CASE
      WHEN (scene->>'id') = (t.marzipano_position->>'sceneId')
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(scene->'hotspots') h
          WHERE h->>'tableId' = t.id::text
        )
      THEN jsonb_set(
        scene,
        '{hotspots}',
        (scene->'hotspots') || jsonb_build_object(
          'id',      'table-' || t.id,
          'type',    'table',
          'yaw',     t.marzipano_position->'yaw',
          'pitch',   t.marzipano_position->'pitch',
          'tableId', t.id
        )
      )
      ELSE scene
    END
  )
  FROM jsonb_array_elements(e.marzipano_config) scene
)
FROM tables t
WHERE t.event_id = e.id
  AND t.marzipano_position IS NOT NULL
  AND e.marzipano_config IS NOT NULL;

-- Step B: drop the redundant columns and their indexes.
DROP INDEX IF EXISTS idx_tables_marzipano_position;
ALTER TABLE tables DROP COLUMN IF EXISTS marzipano_position;

ALTER TABLE areas DROP COLUMN IF EXISTS marzipano_position;
