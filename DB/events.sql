CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample data
INSERT INTO events (id, title, description, completed) 
VALUES 
    (gen_random_uuid(), 'Learn Rust', 'Build a backend API', false),
    (gen_random_uuid(), 'Setup PostgreSQL', 'Connect to database', true)
ON CONFLICT DO NOTHING;