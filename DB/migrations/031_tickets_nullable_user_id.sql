-- Migration 031: Make tickets.user_id nullable
-- Required for free guests and anonymous paying guests who don't have an account yet
ALTER TABLE tickets ALTER COLUMN user_id DROP NOT NULL;
