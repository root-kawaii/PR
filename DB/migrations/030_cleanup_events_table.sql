-- Remove deprecated matterport_id column from events table.
-- This field was superseded by tour_provider + tour_id / marzipano_config.
ALTER TABLE events DROP COLUMN IF EXISTS matterport_id;
