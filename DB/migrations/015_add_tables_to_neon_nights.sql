-- Migration 015: Add tables to NEON NIGHTS event
-- This migration adds available tables for the NEON NIGHTS - SPECIAL EVENT

-- Insert tables for NEON NIGHTS event
INSERT INTO tables (event_id, name, zone, capacity, min_spend, total_cost, available, location_description, features)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'VIP Table 1',
        'VIP Area',
        10,
        50.00,
        500.00,
        true,
        'Premium VIP table with exclusive area access',
        ARRAY[
            'VIP Area riservata',
            'Servizio premium',
            'Vista panoramica sulla pista',
            'Accesso prioritario'
        ]
    ),
    (
        '11111111-1111-1111-1111-111111111111',
        'Table B-1',
        'Main Floor',
        12,
        35.00,
        420.00,
        true,
        'Posizione centrale vicino alla pista da ballo',
        ARRAY[
            'Vista ottimale sulla pista da ballo',
            'Servizio tavolo dedicato',
            'Ideale per gruppi'
        ]
    ),
    (
        '11111111-1111-1111-1111-111111111111',
        'Table B-2',
        'Main Floor',
        15,
        35.00,
        525.00,
        true,
        'Tavolo grande ideale per grandi gruppi',
        ARRAY[
            'Vista ottimale sulla pista da ballo',
            'Servizio tavolo dedicato',
            'Ideale per gruppi fino a 15 persone'
        ]
    ),
    (
        '11111111-1111-1111-1111-111111111111',
        'Table A-1',
        'Bar Area',
        8,
        30.00,
        240.00,
        true,
        'Tavolo vicino al bar per facile accesso',
        ARRAY[
            'Vicino al bar',
            'Facile accesso ai drink',
            'Perfetto per gruppi piccoli'
        ]
    );
