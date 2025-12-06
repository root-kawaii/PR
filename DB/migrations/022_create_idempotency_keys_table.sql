-- Migration 022: Create lightweight idempotency_keys table
-- Purpose: Enable idempotent payment processing to prevent duplicate Stripe charges
-- Date: 2025-12-06

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core idempotency fields
    idempotency_key UUID NOT NULL UNIQUE,
    request_hash VARCHAR(64) NOT NULL,  -- SHA256 hash of request payload for validation

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed

    -- Link to the payment created
    payment_id UUID,  -- References payments.id

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL  -- TTL for cleanup (24 hours default)
);

-- Indexes
CREATE UNIQUE INDEX idx_idempotency_key ON idempotency_keys(idempotency_key);
CREATE INDEX idx_idempotency_status ON idempotency_keys(status);
CREATE INDEX idx_idempotency_expires_at ON idempotency_keys(expires_at);

-- Partial index for active operations (performance optimization)
CREATE INDEX idx_idempotency_active ON idempotency_keys(idempotency_key, status)
WHERE status IN ('pending', 'in_progress');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_idempotency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_idempotency_updated_at
    BEFORE UPDATE ON idempotency_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_idempotency_updated_at();

-- Cleanup expired records function
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW() AND status IN ('completed', 'failed');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE idempotency_keys IS 'Lightweight table for tracking idempotency to prevent duplicate payments';
COMMENT ON COLUMN idempotency_keys.idempotency_key IS 'Client-provided UUID to identify unique requests';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'SHA256 hash of request payload to validate consistency';
COMMENT ON COLUMN idempotency_keys.payment_id IS 'ID of the payment created (if successful)';
COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Delete expired idempotency records (run hourly)';
