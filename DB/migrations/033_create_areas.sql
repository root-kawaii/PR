-- Migration 033: Create areas table and link tables to areas
-- Areas represent venue zones (e.g., "VIP", "Main Floor", "Terrazza").
-- Each area has a price that sets the per-person cost for tables assigned to it.

CREATE TABLE IF NOT EXISTS areas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,          -- per-person price for tables in this area
    description TEXT,
    marzipano_position JSONB,                      -- {sceneId, yaw, pitch} for virtual tour hotspot
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_club_id ON areas(club_id);

-- Add area_id FK to tables (nullable — existing tables have no area)
ALTER TABLE tables
    ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tables_area_id ON tables(area_id);
