-- Migration 042: Add marzipano_config to clubs table
--
-- Enables club-level 360° tour configuration. The mobile viewer uses the
-- event's marzipano_config when present, otherwise falls back to the club's
-- marzipano_config. The JSONB shape is identical (array of MarzipanoScene).

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS marzipano_config JSONB;

CREATE INDEX IF NOT EXISTS idx_clubs_marzipano_config
  ON clubs USING GIN (marzipano_config);
