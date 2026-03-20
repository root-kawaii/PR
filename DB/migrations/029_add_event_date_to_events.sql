-- Migration 029: Add a proper machine-readable date column to events
-- Purpose: The existing `date` column is a display string (e.g. "10 MAG | 23:00").
--          The payment scheduler needs a real DATE to decide when to capture/re-authorize.
--          New events should populate both `date` (display) and `event_date` (real date).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_date DATE;

CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date)
  WHERE event_date IS NOT NULL;
