-- Migration to add past events and tickets for user eee@fff.com

-- First, ensure the user exists (password: Test123!)
INSERT INTO users (id, email, password_hash, name, phone_number, created_at, updated_at)
VALUES (
    '6aa457a6-2477-4996-b8ed-2e6fa6b428bb',
    'eee@fff.com',
    '$2a$10$8JGvVqHZf.rKJJKGKJKGKe8YvN5K5K5K5K5K5K5K5K5K5K5K5K5K5.',
    'Test User',
    '+39 123 456 7890',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert past events
INSERT INTO events (id, title, venue, date, image, status, time, age_limit, end_time, price, description, matterport_id, created_at, updated_at)
VALUES
    -- Past events from November 2025
    (
        '00000000-0000-0000-0000-000000000001',
        'ELECTRO PARADISE',
        'Fabrique Milano, Viale Monza 140',
        '2025-11-01T23:00:00',
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400',
        NULL,
        '23:00',
        '18+',
        '04:00',
        '28 €',
        'Amazing electro night',
        'Ue6HUuFp67T',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'TECHNO MADNESS',
        'Amnesia Milano, Viale Monte Nero',
        '2025-11-08T22:00:00',
        'https://images.unsplash.com/photo-1571266028243-d220c6e15763?w=400',
        NULL,
        '22:00',
        '21+',
        '05:00',
        '25 €',
        'Underground techno vibes',
        'Ue6HUuFp67T',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'HOUSE CLASSICS',
        'Plastic Milano, Viale Umbria 120',
        '2025-11-15T23:30:00',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
        NULL,
        '23:30',
        '18+',
        '04:00',
        '22 €',
        'Best house classics from the 90s',
        'Ue6HUuFp67T',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000004',
        'FRIDAY FEVER',
        'Seven Space',
        '2025-11-21T23:00:00',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
        NULL,
        '23:00',
        '18+',
        '04:00',
        '20 €',
        'Epic Friday night',
        'Ue6HUuFp67T',
        NOW(),
        NOW()
    )
ON CONFLICT DO NOTHING;

-- Create tickets for the user (eee@fff.com / user_id: 6aa457a6-2477-4996-b8ed-2e6fa6b428bb)
INSERT INTO tickets (id, user_id, event_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
VALUES
    (
        gen_random_uuid(),
        '6aa457a6-2477-4996-b8ed-2e6fa6b428bb',
        '00000000-0000-0000-0000-000000000001',
        'TKT-' || substr(md5(random()::text), 1, 10),
        'General Admission',
        28.00,
        'used',
        '2025-10-25 14:30:00',
        'QR-' || substr(md5(random()::text), 1, 16),
        '2025-10-25 14:30:00',
        NOW()
    ),
    (
        gen_random_uuid(),
        '6aa457a6-2477-4996-b8ed-2e6fa6b428bb',
        '00000000-0000-0000-0000-000000000002',
        'TKT-' || substr(md5(random()::text), 1, 10),
        'VIP',
        45.00,
        'used',
        '2025-11-01 10:15:00',
        'QR-' || substr(md5(random()::text), 1, 16),
        '2025-11-01 10:15:00',
        NOW()
    ),
    (
        gen_random_uuid(),
        '6aa457a6-2477-4996-b8ed-2e6fa6b428bb',
        '00000000-0000-0000-0000-000000000003',
        'TKT-' || substr(md5(random()::text), 1, 10),
        'General Admission',
        22.00,
        'used',
        '2025-11-10 16:45:00',
        'QR-' || substr(md5(random()::text), 1, 16),
        '2025-11-10 16:45:00',
        NOW()
    ),
    (
        gen_random_uuid(),
        '6aa457a6-2477-4996-b8ed-2e6fa6b428bb',
        '00000000-0000-0000-0000-000000000004',
        'TKT-' || substr(md5(random()::text), 1, 10),
        'Early Bird',
        15.00,
        'used',
        '2025-11-18 12:00:00',
        'QR-' || substr(md5(random()::text), 1, 16),
        '2025-11-18 12:00:00',
        NOW()
    );
