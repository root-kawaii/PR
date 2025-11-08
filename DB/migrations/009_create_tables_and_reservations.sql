-- Migration 009: Create Tables and Table Reservations System
-- This migration creates the table reservation system where users can book entire tables for events

-- Create tables table (represents physical tables at events)
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Tavolo B-2", "VIP Table 1"
    zone VARCHAR(100), -- e.g., "Molto", "VIP Area", "Main Floor"
    capacity INT NOT NULL, -- Maximum number of people
    min_spend DECIMAL(10, 2) NOT NULL, -- Minimum spend per person (e.g., 30.00)
    total_cost DECIMAL(10, 2) NOT NULL, -- Total minimum cost for the table (capacity * min_spend)
    available BOOLEAN NOT NULL DEFAULT true,
    location_description TEXT, -- e.g., "Posizione centrale nella discoteca"
    features TEXT[], -- Array of features, e.g., ["Vista ottimale sulla pista da ballo", "Servizio tavolo dedicato"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table_reservations table (represents bookings of tables)
CREATE TABLE IF NOT EXISTS table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

    -- Reservation details
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    num_people INT NOT NULL, -- Number of people in this reservation

    -- Payment tracking
    total_amount DECIMAL(10, 2) NOT NULL, -- Total amount to be paid
    amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- Amount already paid

    -- Contact information
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,

    -- Additional info
    special_requests TEXT,
    reservation_code VARCHAR(50) NOT NULL UNIQUE, -- e.g., "RES-XXXXXXXX"

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table_reservation_payments junction table (tracks individual payments for a reservation)
CREATE TABLE IF NOT EXISTS table_reservation_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table_reservation_tickets junction table (links tickets to table reservations)
-- This allows tracking which specific tickets are associated with a table reservation
CREATE TABLE IF NOT EXISTS table_reservation_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ticket_id) -- Each ticket can only belong to one reservation
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tables_event_id ON tables(event_id);
CREATE INDEX IF NOT EXISTS idx_tables_available ON tables(available);
CREATE INDEX IF NOT EXISTS idx_table_reservations_table_id ON table_reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_user_id ON table_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_event_id ON table_reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_status ON table_reservations(status);
CREATE INDEX IF NOT EXISTS idx_table_reservations_code ON table_reservations(reservation_code);
CREATE INDEX IF NOT EXISTS idx_table_reservation_payments_reservation_id ON table_reservation_payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_table_reservation_tickets_reservation_id ON table_reservation_tickets(reservation_id);
CREATE INDEX IF NOT EXISTS idx_table_reservation_tickets_ticket_id ON table_reservation_tickets(ticket_id);

-- Insert sample tables for the "SOLD OUT" event (Fabrique)
DO $$
DECLARE
    v_event_id UUID;
BEGIN
    -- Get the "SOLD OUT" event at Fabrique
    SELECT id INTO v_event_id FROM events WHERE title = 'SOLD OUT' AND venue LIKE '%Fabrique%' LIMIT 1;

    IF v_event_id IS NOT NULL THEN
        -- Insert Table B-2 (from the design mockup)
        INSERT INTO tables (id, event_id, name, zone, capacity, min_spend, total_cost, available, location_description, features)
        VALUES (
            gen_random_uuid(),
            v_event_id,
            'Tavolo B-2',
            'Molto',
            15,
            30.00,
            450.00, -- 15 * 30.00
            true,
            'Posizione centrale nella discoteca',
            ARRAY[
                'Vista ottimale sulla pista da ballo',
                'Servizio tavolo dedicato',
                'Ideale per gruppi fino a 15 persone'
            ]
        );

        -- Insert VIP Table 1
        INSERT INTO tables (id, event_id, name, zone, capacity, min_spend, total_cost, available, location_description, features)
        VALUES (
            gen_random_uuid(),
            v_event_id,
            'Tavolo VIP-1',
            'VIP Area',
            10,
            50.00,
            500.00,
            true,
            'Tavolo VIP esclusivo nell''area riservata',
            ARRAY[
                'Area VIP riservata',
                'Servizio premium',
                'Vista panoramica',
                'Accesso prioritario'
            ]
        );

        -- Insert another standard table
        INSERT INTO tables (id, event_id, name, zone, capacity, min_spend, total_cost, available, location_description, features)
        VALUES (
            gen_random_uuid(),
            v_event_id,
            'Tavolo A-1',
            'Main Floor',
            8,
            25.00,
            200.00,
            true,
            'Tavolo vicino al bar',
            ARRAY[
                'Vicino al bar',
                'Facile accesso',
                'Ideale per gruppi piccoli'
            ]
        );

        RAISE NOTICE 'Inserted 3 sample tables for event %', v_event_id;
    ELSE
        RAISE NOTICE 'Event not found, skipping sample table insertion';
    END IF;
END $$;

-- Insert sample table for "KUREMINO LIVE SHOW" event
DO $$
DECLARE
    v_event_id UUID;
BEGIN
    SELECT id INTO v_event_id FROM events WHERE title = 'KUREMINO LIVE SHOW' LIMIT 1;

    IF v_event_id IS NOT NULL THEN
        INSERT INTO tables (event_id, name, zone, capacity, min_spend, total_cost, available, location_description, features)
        VALUES (
            v_event_id,
            'Tavolo Premium',
            'Front Stage',
            12,
            35.00,
            420.00,
            true,
            'Tavolo frontale vicino al palco',
            ARRAY[
                'Vista diretta sul palco',
                'Esperienza live ottimale',
                'Servizio dedicato'
            ]
        );

        RAISE NOTICE 'Inserted sample table for KUREMINO LIVE SHOW event';
    END IF;
END $$;