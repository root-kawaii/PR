-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subtitle VARCHAR(512), -- Address or short description
    image VARCHAR(512) NOT NULL, -- Image URL
    address VARCHAR(512),
    phone_number VARCHAR(50),
    website VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);

-- Insert sample clubs data
INSERT INTO clubs (id, name, subtitle, image, address, phone_number, created_at, updated_at)
VALUES
    (
        gen_random_uuid(),
        'PULP ENTERTAINMENT',
        'Via Macerano 18, Gallaratese',
        'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=300',
        'Via Macerano 18, Milano',
        '+39 02 1234567',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'DO IT BETTER',
        'Via Della Giustizia, 2 - Isola',
        'https://images.unsplash.com/photo-1571266028243-d220c6e15763?w=300',
        'Via Della Giustizia 2, Milano',
        '+39 02 7654321',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'FABRIQUE',
        'Viale Monza 140 - Lambrate',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
        'Viale Monza 140, Milano',
        '+39 02 9876543',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'SANTERIA TOSCANA',
        'Viale Toscana 31 - Lambrate',
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=300',
        'Viale Toscana 31, Milano',
        '+39 02 5551234',
        NOW(),
        NOW()
    )
ON CONFLICT DO NOTHING;