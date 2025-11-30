-- Migration: Add Payment Authorization & Capture Support
-- Purpose: Enable Stripe authorization/capture flow for table reservations
-- Date: 2025-11-30

-- Add authorization and capture tracking fields to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS capture_method VARCHAR(20) DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS authorization_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS authorized_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS captured_amount DECIMAL(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN payments.capture_method IS 'Payment capture method: automatic or manual';
COMMENT ON COLUMN payments.authorization_status IS 'Authorization status: pending, authorized, captured, cancelled, failed';
COMMENT ON COLUMN payments.authorized_at IS 'Timestamp when funds were authorized';
COMMENT ON COLUMN payments.captured_at IS 'Timestamp when funds were captured';
COMMENT ON COLUMN payments.cancelled_at IS 'Timestamp when authorization was cancelled';
COMMENT ON COLUMN payments.authorized_amount IS 'Original authorized amount in dollars';
COMMENT ON COLUMN payments.captured_amount IS 'Final captured amount (may differ for partial captures)';

-- Create index for authorization status queries
CREATE INDEX IF NOT EXISTS idx_payments_authorization_status ON payments(authorization_status);

-- Create index for capture method queries
CREATE INDEX IF NOT EXISTS idx_payments_capture_method ON payments(capture_method);

-- Create index for expired authorizations (7 days)
CREATE INDEX IF NOT EXISTS idx_payments_authorized_at ON payments(authorized_at)
WHERE authorization_status = 'authorized';
