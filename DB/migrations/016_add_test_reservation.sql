-- Migration 016: Add test reservation for NEON NIGHTS event
-- This creates a sample reservation so users can test the reservation detail flow

DO $$
DECLARE
    v_table_id UUID;
    v_reservation_id UUID;
BEGIN
    -- Get the VIP Table 1 for NEON NIGHTS event
    SELECT id INTO v_table_id
    FROM tables
    WHERE event_id = '11111111-1111-1111-1111-111111111111'
    AND name = 'VIP Table 1'
    LIMIT 1;

    IF v_table_id IS NOT NULL THEN
        -- Create a test reservation
        INSERT INTO table_reservations (
            id,
            table_id,
            user_id,
            event_id,
            status,
            num_people,
            total_amount,
            amount_paid,
            contact_name,
            contact_email,
            contact_phone,
            special_requests,
            reservation_code,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_table_id,
            '6aa457a6-2477-4996-b8ed-2e6fa6b428bb', -- eee@fff.com user
            '11111111-1111-1111-1111-111111111111',
            'confirmed',
            10, -- Full capacity for VIP table
            500.00, -- 10 people * €50/person
            250.00, -- Already paid 50%
            'Test User',
            'eee@fff.com',
            '+39 123 456 7890',
            'Window seat preferred, celebrating birthday',
            'RES-NEON2024',
            NOW(),
            NOW()
        ) RETURNING id INTO v_reservation_id;

        RAISE NOTICE 'Created test reservation: % for table: %', v_reservation_id, v_table_id;
    ELSE
        RAISE NOTICE 'VIP Table 1 not found for NEON NIGHTS event';
    END IF;
END $$;
