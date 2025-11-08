-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL, -- Hex color code like #ec4899
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_genres_name ON genres(name);

-- Insert sample genres data
INSERT INTO genres (id, name, color, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'ITALIANA', '#ec4899', NOW(), NOW()),
    (gen_random_uuid(), 'HIP HOP', '#fbbf24', NOW(), NOW()),
    (gen_random_uuid(), 'LATINO', '#3b82f6', NOW(), NOW()),
    (gen_random_uuid(), 'TECHNO', '#8b5cf6', NOW(), NOW()),
    (gen_random_uuid(), 'HOUSE', '#10b981', NOW(), NOW()),
    (gen_random_uuid(), 'REGGAETON', '#f59e0b', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;