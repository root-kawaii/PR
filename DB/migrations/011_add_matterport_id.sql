-- Migration to add matterport_id field to events table

-- Add the matterport_id column
ALTER TABLE events ADD COLUMN IF NOT EXISTS matterport_id VARCHAR(50);

-- Update all existing events with the default Matterport ID
UPDATE events SET matterport_id = 'Ue6HUuFp67T' WHERE matterport_id IS NULL;

-- Add comment to document the field
COMMENT ON COLUMN events.matterport_id IS 'Matterport 3D view ID for virtual venue tour';
