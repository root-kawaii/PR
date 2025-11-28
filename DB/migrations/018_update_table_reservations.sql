-- Migration 018: Update table_reservations to store arrays of payments, tickets, and guest users
-- This removes the need for junction tables

ALTER TABLE table_reservations
ADD COLUMN IF NOT EXISTS guest_user_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS payment_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ticket_ids UUID[] DEFAULT '{}';

-- Create GIN indexes for efficient array queries
CREATE INDEX IF NOT EXISTS idx_table_reservations_guest_user_ids ON table_reservations USING GIN(guest_user_ids);
CREATE INDEX IF NOT EXISTS idx_table_reservations_payment_ids ON table_reservations USING GIN(payment_ids);
CREATE INDEX IF NOT EXISTS idx_table_reservations_ticket_ids ON table_reservations USING GIN(ticket_ids);

-- Note: Keeping amount_paid column for tracking cumulative payment amount
-- Note: Keeping user_id column as the reservation owner
