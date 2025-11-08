-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_code VARCHAR(50) NOT NULL UNIQUE, -- Unique ticket code (e.g., "TKT-ABC123")
    ticket_type VARCHAR(50) NOT NULL, -- e.g., "VIP", "General Admission", "Early Bird"
    price DECIMAL(10, 2) NOT NULL, -- Ticket price
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- e.g., "active", "used", "cancelled", "refunded"
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    qr_code VARCHAR(512), -- URL or data for QR code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_purchase_date ON tickets(purchase_date DESC);

-- Insert sample tickets data (for testing - in production these would be created when users purchase)
-- First, get some user and event IDs
DO $$
DECLARE
    sample_user_id UUID;
    event1_id UUID;
    event2_id UUID;
    event3_id UUID;
BEGIN
    -- Get the first user
    SELECT id INTO sample_user_id FROM users LIMIT 1;

    -- Get some event IDs
    SELECT id INTO event1_id FROM events WHERE title = 'SOLD OUT' LIMIT 1;
    SELECT id INTO event2_id FROM events WHERE title LIKE '%KUREMINO%' LIMIT 1;
    SELECT id INTO event3_id FROM events WHERE title LIKE '%SATURDAY%' LIMIT 1;

    -- Insert sample tickets only if we have the required data
    IF sample_user_id IS NOT NULL AND event1_id IS NOT NULL THEN
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, created_at, updated_at)
        VALUES
            (
                gen_random_uuid(),
                event1_id,
                sample_user_id,
                'TKT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),
                'VIP',
                32.00,
                'active',
                NOW() - INTERVAL '3 days',
                NOW(),
                NOW()
            );
    END IF;

    IF sample_user_id IS NOT NULL AND event2_id IS NOT NULL THEN
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, created_at, updated_at)
        VALUES
            (
                gen_random_uuid(),
                event2_id,
                sample_user_id,
                'TKT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),
                'General Admission',
                25.00,
                'active',
                NOW() - INTERVAL '1 day',
                NOW(),
                NOW()
            );
    END IF;

    IF sample_user_id IS NOT NULL AND event3_id IS NOT NULL THEN
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, created_at, updated_at)
        VALUES
            (
                gen_random_uuid(),
                event3_id,
                sample_user_id,
                'TKT-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),
                'Early Bird',
                15.00,
                'used',
                NOW() - INTERVAL '7 days',
                NOW(),
                NOW()
            );
    END IF;
END $$;