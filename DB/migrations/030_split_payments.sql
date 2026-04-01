-- Migration 030: Split payment support
-- Decouples payment from guest count. Each paying guest gets their own payment share
-- with a shareable link. Non-paying guests can be added separately.

-- Tracks each person's slice of the table cost
CREATE TABLE IF NOT EXISTS reservation_payment_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone_number VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    stripe_payment_intent_id VARCHAR(255),
    payment_link_token VARCHAR(100) UNIQUE,
    payment_id UUID REFERENCES payments(id),
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    guest_name VARCHAR(255),
    guest_email VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Non-paying guests added after booking
CREATE TABLE IF NOT EXISTS reservation_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone_number VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    added_by UUID NOT NULL REFERENCES users(id),
    ticket_id UUID REFERENCES tickets(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(reservation_id, phone_number)
);

-- Indexes
CREATE INDEX idx_payment_shares_reservation ON reservation_payment_shares(reservation_id);
CREATE INDEX idx_payment_shares_token ON reservation_payment_shares(payment_link_token);
CREATE INDEX idx_payment_shares_status ON reservation_payment_shares(status);
CREATE INDEX idx_payment_shares_checkout_session ON reservation_payment_shares(stripe_checkout_session_id);
CREATE INDEX idx_reservation_guests_reservation ON reservation_guests(reservation_id);
