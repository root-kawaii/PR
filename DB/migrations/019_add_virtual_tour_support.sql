-- Add virtual tour support to events table
-- Supports multiple tour providers (Kuula, Matterport, etc.)

ALTER TABLE events
ADD COLUMN IF NOT EXISTS tour_provider VARCHAR(50), -- 'kuula', 'matterport', etc.
ADD COLUMN IF NOT EXISTS tour_id VARCHAR(255); -- Tour ID from the provider

-- Create index for tour queries
CREATE INDEX IF NOT EXISTS idx_events_tour_id ON events(tour_id) WHERE tour_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.tour_provider IS 'Virtual tour provider (kuula, matterport, cloudpano, etc.)';
COMMENT ON COLUMN events.tour_id IS 'Tour ID from the virtual tour provider';
