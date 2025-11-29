-- Insert test users with simple phone numbers for testing
INSERT INTO users (id, email, password_hash, name, phone_number, avatar_url, created_at, updated_at) VALUES
  (gen_random_uuid(), 'test1@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfj4g.NJlW', 'Test User 1', '1', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'test2@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfj4g.NJlW', 'Test User 2', '2', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'test3@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfj4g.NJlW', 'Test User 3', '3', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'test4@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfj4g.NJlW', 'Test User 4', '4', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'test5@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfj4g.NJlW', 'Test User 5', '5', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'test6@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYfj4g.NJlW', 'Test User 6', '6', NULL, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Also ensure these phone numbers are unique
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_phone_number_unique UNIQUE (phone_number);
