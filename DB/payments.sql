CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    insert_date TIMESTAMP,
    update_date TIMESTAMP
);


-- Insert some sample data
INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date) 
VALUES 
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 100.00, 'completed', NOW(), NOW()),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 250.50, 'pending', NOW(), NOW())
ON CONFLICT DO NOTHING;