-- Add Matterport 3D position coordinates to tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS matterport_x FLOAT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS matterport_y FLOAT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS matterport_z FLOAT;

-- Add comment to explain the columns
COMMENT ON COLUMN tables.matterport_x IS '3D X coordinate for table position in Matterport space';
COMMENT ON COLUMN tables.matterport_y IS '3D Y coordinate for table position in Matterport space';
COMMENT ON COLUMN tables.matterport_z IS '3D Z coordinate for table position in Matterport space';
