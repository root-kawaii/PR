-- Migration 028: Multiple images for clubs and tables
-- Requires discussion with backend colleague before applying

-- Multiple images for venues/clubs
CREATE TABLE club_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_club_images_club_id ON club_images(club_id);

-- Multiple images for tables
CREATE TABLE table_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_table_images_table_id ON table_images(table_id);
