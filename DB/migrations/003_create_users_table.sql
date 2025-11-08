-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    avatar_url VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Insert demo users for development/testing
-- Note: These are for development only, remove in production
INSERT INTO users (id, email, password_hash, name, phone_number, created_at, updated_at)
VALUES
    -- Demo User 1: demo@pierre.com / Demo123!
    (
        gen_random_uuid(),
        'demo@pierre.com',
        '$2b$12$K8qV5L.vYj6xN9zJ5H8QXeR7KvQm3P4nW2dT6fS8gH9jL1mN0oP2q',
        'Demo User',
        '+39 340 1234567',
        NOW(),
        NOW()
    ),
    -- Demo User 2: mario@test.com / Party2024!
    (
        gen_random_uuid(),
        'mario@test.com',
        '$2b$12$M9rW6M.wZk7yO0aK6I9RYfS8LwRn4Q5oX3eU7gT9hI0kM2nO1pQ3r',
        'Mario Rossi',
        '+39 345 9876543',
        NOW(),
        NOW()
    ),
    -- Demo User 3: test@example.com / password123
    (
        gen_random_uuid(),
        'test@example.com',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqVr/8K4qO',
        'Test User',
        '+1234567890',
        NOW(),
        NOW()
    )
ON CONFLICT (email) DO NOTHING;