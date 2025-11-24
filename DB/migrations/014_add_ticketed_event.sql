-- Migration to add a special event with ticket purchasing enabled

-- Insert a featured event for ticket purchasing
INSERT INTO events (id, title, venue, date, image, status, time, age_limit, end_time, price, description, matterport_id, created_at, updated_at)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'NEON NIGHTS - SPECIAL EVENT',
        'Fabrique Milano, Viale Monza 140',
        '2025-11-30T22:00:00',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
        'HOT',
        '22:00',
        '18+',
        '05:00',
        '35 €',
        'Join us for the most anticipated event of the year! NEON NIGHTS brings together the best DJs in Milan for an unforgettable night of music, lights, and pure energy. VIP areas available with bottle service. Early bird tickets available now!',
        'Ue6HUuFp67T',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    venue = EXCLUDED.venue,
    date = EXCLUDED.date,
    image = EXCLUDED.image,
    status = EXCLUDED.status,
    time = EXCLUDED.time,
    age_limit = EXCLUDED.age_limit,
    end_time = EXCLUDED.end_time,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    matterport_id = EXCLUDED.matterport_id,
    updated_at = NOW();
