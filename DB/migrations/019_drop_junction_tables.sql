-- Migration 019: Drop junction tables that are no longer needed
-- table_reservations now directly stores arrays of payment_ids and ticket_ids

-- Drop the junction table for table reservation payments
DROP TABLE IF EXISTS table_reservation_payments;

-- Drop the junction table for table reservation tickets
DROP TABLE IF EXISTS table_reservation_tickets;
