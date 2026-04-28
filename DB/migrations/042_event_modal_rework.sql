-- Migration 042: Event modal rework
-- Adds event_genres join table linking events to the existing genres table.
-- No changes to the events table itself (venue stays NOT NULL, handled at FE).

CREATE TABLE IF NOT EXISTS event_genres (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_event_genres_event_id ON event_genres(event_id);
