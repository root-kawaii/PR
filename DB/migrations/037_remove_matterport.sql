-- Migration 037: Remove deprecated Matterport columns.
-- Matterport has been superseded by Marzipano (migration 025).
-- The matterport_id column on events and matterport_x/y/z on tables are
-- no longer used by any backend or frontend code.
ALTER TABLE events
    DROP COLUMN IF EXISTS matterport_id,
    DROP COLUMN IF EXISTS tour_id;

ALTER TABLE tables
    DROP COLUMN IF EXISTS matterport_x,
    DROP COLUMN IF EXISTS matterport_y,
    DROP COLUMN IF EXISTS matterport_z;
