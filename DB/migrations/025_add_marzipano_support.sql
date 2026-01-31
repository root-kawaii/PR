-- Migration: Add Marzipano 360° Viewer Support
-- Description: Adds support for Marzipano open-source 360° panorama viewer
--              as an alternative to Matterport for venue virtual tours

-- Add Marzipano configuration column to events table
-- Stores JSON array of scenes with hotspot configurations
ALTER TABLE events
ADD COLUMN IF NOT EXISTS marzipano_config JSONB;

-- Add Marzipano hotspot position column to tables table
-- Stores JSON object with sceneId, yaw, and pitch for each table
ALTER TABLE tables
ADD COLUMN IF NOT EXISTS marzipano_position JSONB;

-- Create GIN index for efficient JSON queries on events
CREATE INDEX IF NOT EXISTS idx_events_marzipano_config
ON events USING GIN (marzipano_config)
WHERE marzipano_config IS NOT NULL;

-- Create GIN index for efficient JSON queries on tables
CREATE INDEX IF NOT EXISTS idx_tables_marzipano_position
ON tables USING GIN (marzipano_position)
WHERE marzipano_position IS NOT NULL;

-- Add comment to document the tour_provider values
COMMENT ON COLUMN events.tour_provider IS 'Virtual tour provider: marzipano (open-source), kuula, matterport, cloudpano';

-- Add comment to explain marzipano_config structure
COMMENT ON COLUMN events.marzipano_config IS 'JSON array of Marzipano scenes. Structure: [{id, name, imageUrl, initialView: {yaw, pitch, fov}, hotspots: [{id, type, yaw, pitch, tableId?, targetSceneId?, label?}]}]';

-- Add comment to explain marzipano_position structure
COMMENT ON COLUMN tables.marzipano_position IS 'JSON object with hotspot position. Structure: {sceneId, yaw, pitch}';

-- Note: The placeholder configuration below will be set programmatically
-- after a placeholder image is added to the app assets.
-- This migration only creates the schema structure.
