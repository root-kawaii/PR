-- Create club_owners table (separate from users)
CREATE TABLE IF NOT EXISTS club_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add owner_id column to clubs (nullable for existing clubs without owners)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES club_owners(id);
CREATE INDEX IF NOT EXISTS idx_clubs_owner_id ON clubs(owner_id);
