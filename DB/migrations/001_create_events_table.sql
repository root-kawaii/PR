CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    insert_date TIMESTAMP,
    update_date TIMESTAMP
);

-- Insert some sample data
INSERT INTO events (id, title, url, description, completed, insert_date, update_date)
VALUES
    (gen_random_uuid(), 'Learn Rust', 'https://rust-lang.org', 'Build a backend API', false, NOW(), NOW()),
    (gen_random_uuid(), 'Setup PostgreSQL', 'https://postgresql.org', 'Connect to database', true, NOW(), NOW())
ON CONFLICT DO NOTHING;