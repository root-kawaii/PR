-- Add expo push token to users for mobile push notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
