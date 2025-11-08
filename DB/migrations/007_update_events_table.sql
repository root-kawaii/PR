-- Drop old events table structure
DROP TABLE IF EXISTS events CASCADE;

-- Create events table matching frontend structure
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    venue VARCHAR(512) NOT NULL,
    date VARCHAR(100) NOT NULL, -- Format: "10 MAG | 23:00"
    image VARCHAR(512) NOT NULL, -- Image URL
    status VARCHAR(50), -- e.g., "SOLD OUT"
    time VARCHAR(20), -- e.g., "23:00"
    age_limit VARCHAR(10), -- e.g., "18+"
    end_time VARCHAR(20), -- e.g., "04:00"
    price VARCHAR(20), -- e.g., "25 €"
    description TEXT,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_club_id ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Insert sample events data
INSERT INTO events (id, title, venue, date, image, status, time, age_limit, end_time, price, description, created_at, updated_at)
VALUES
    (
        gen_random_uuid(),
        'SOLD OUT',
        'Fabrique, Viale Monza 140',
        '10 MAG | 23:00',
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400',
        'SOLD OUT',
        '23:00',
        '18+',
        '22:30',
        '32 €',
        'Entre nella lista d''attese per i biglietti',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'KUREMINO LIVE SHOW',
        'Santeria Toscana, Viale Toscana 31',
        '10 FEB | 20:00',
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400',
        NULL,
        '20:00',
        '16+',
        '02:00',
        '25 €',
        'Live music performance with special guest',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'SATURDAY NIGHT',
        'Seven Space',
        '27 DIC | 23:00',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
        NULL,
        '23:00',
        '18+',
        '04:00',
        '20 €',
        'Saturday night party with top DJs',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'TECHNO NIGHT',
        'PULP ENTERTAINMENT, Via Macerano 18',
        '15 GEN | 23:30',
        'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400',
        NULL,
        '23:30',
        '18+',
        '05:00',
        '15 €',
        'Techno music all night long',
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'REGGAETON PARTY',
        'DO IT BETTER, Via Della Giustizia 2',
        '20 GEN | 22:00',
        'https://images.unsplash.com/photo-1571266028243-d220c6e15763?w=400',
        NULL,
        '22:00',
        '16+',
        '03:00',
        '18 €',
        'Best reggaeton hits all night',
        NOW(),
        NOW()
    )
ON CONFLICT DO NOTHING;