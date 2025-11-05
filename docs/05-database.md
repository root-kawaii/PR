# Database Documentation

## Technology

- **Database**: PostgreSQL 16
- **Container**: Docker Compose
- **Driver**: SQLx (Rust)
- **Location**: `/DB/`

## Docker Setup

**Location**: [DB/docker-compose.yaml](../DB/docker-compose.yaml)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: events_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: events
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: events
- **Username**: postgres
- **Password**: password

**Connection String**:
```
postgresql://postgres:password@localhost:5432/events
```

## Database Schema

### Events Table

**Location**: [DB/events.sql](../DB/events.sql)

```sql
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `id` - UUID primary key (generated in application)
- `title` - Event title (max 255 chars, required)
- `description` - Full event description (text, optional)
- `completed` - Boolean flag (default: false)
- `created_at` - Timestamp with timezone (auto-generated)
- `updated_at` - Timestamp with timezone (auto-generated)

**Indexes**:
```sql
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_completed ON events(completed);
```

### Payments Table

**Location**: [DB/payments.sql](../DB/payments.sql)

```sql
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `id` - UUID primary key (generated in application)
- `sender_id` - User ID of payer (varchar, required)
- `receiver_id` - User ID of recipient (varchar, required)
- `amount` - Payment amount (decimal 10,2 - up to 99,999,999.99)
- `status` - Payment status (varchar 50, default: 'Pending')
- `created_at` - Timestamp with timezone (auto-generated)
- `updated_at` - Timestamp with timezone (auto-generated)

**Payment Statuses**:
- `Pending` - Payment initiated, awaiting confirmation
- `Completed` - Payment successfully processed
- `Failed` - Payment failed or declined

**Indexes**:
```sql
CREATE INDEX idx_payments_sender ON payments(sender_id);
CREATE INDEX idx_payments_receiver ON payments(receiver_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

**Constraints**:
```sql
ALTER TABLE payments ADD CONSTRAINT check_amount_positive
    CHECK (amount > 0);
```

## Entity Relationships

```
events (standalone)
    - No foreign key relationships currently

payments (standalone)
    - sender_id references users (not implemented)
    - receiver_id references users (not implemented)
```

**Future Relationships**:
```
users
  ├── payments (as sender)
  └── payments (as receiver)

events
  ├── venues
  ├── reservations
  └── tables

reservations
  ├── users
  ├── events
  ├── tables
  └── payments
```

## Database Operations

### Starting the Database

```bash
cd DB

# Start PostgreSQL container
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f postgres
```

### Stopping the Database

```bash
cd DB

# Stop container
docker-compose stop

# Stop and remove container
docker-compose down

# Stop and remove with data
docker-compose down -v
```

### Initializing Schema

```bash
# Connect to database
docker exec -it events_postgres psql -U postgres -d events

# Or using psql client
psql postgresql://postgres:password@localhost:5432/events

# Run schema files
\i /path/to/events.sql
\i /path/to/payments.sql
```

### Manual Queries

**List all events**:
```sql
SELECT * FROM events ORDER BY created_at DESC;
```

**Create event**:
```sql
INSERT INTO events (id, title, description, completed, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Sample Event',
    'Event description',
    false,
    NOW(),
    NOW()
);
```

**List all payments**:
```sql
SELECT * FROM payments ORDER BY created_at DESC;
```

**Filter payments by status**:
```sql
SELECT * FROM payments WHERE status = 'Completed';
```

**Get payment totals by status**:
```sql
SELECT status, COUNT(*), SUM(amount) as total
FROM payments
GROUP BY status;
```

## Database Migrations

**Current State**: No migration framework implemented

**Recommended Setup**: Use SQLx migrations

```bash
# Install SQLx CLI
cargo install sqlx-cli --no-default-features --features postgres

# Create migration
sqlx migrate add create_events_table

# Run migrations
sqlx migrate run

# Revert migration
sqlx migrate revert
```

**Example Migration**:
```sql
-- migrations/20240101000000_create_events_table.sql
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_created_at ON events(created_at DESC);
```

## Backup and Restore

### Backup

```bash
# Backup entire database
docker exec events_postgres pg_dump -U postgres events > backup.sql

# Backup specific table
docker exec events_postgres pg_dump -U postgres -t events events > events_backup.sql
```

### Restore

```bash
# Restore database
docker exec -i events_postgres psql -U postgres events < backup.sql

# Restore table
docker exec -i events_postgres psql -U postgres events < events_backup.sql
```

## Performance Tuning

**Current Configuration**: Default PostgreSQL settings

**Recommended Optimizations**:

```sql
-- Vacuum regularly
VACUUM ANALYZE events;
VACUUM ANALYZE payments;

-- Update statistics
ANALYZE events;
ANALYZE payments;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

**Connection Pooling**:
- Backend uses SQLx with max 5 connections
- Adjust based on load: `PgPoolOptions::new().max_connections(20)`

## Monitoring

**Check table sizes**:
```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Check active connections**:
```sql
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'events';
```

**Check slow queries**:
```sql
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Common Issues

### Issue: Connection refused
```
Error: connection refused at localhost:5432
```
**Solution**: Ensure Docker container is running
```bash
docker-compose ps
docker-compose up -d
```

### Issue: Authentication failed
```
Error: password authentication failed for user "postgres"
```
**Solution**: Check credentials in docker-compose.yaml and connection string

### Issue: Database doesn't exist
```
Error: database "events" does not exist
```
**Solution**: Database is created automatically by Docker. Restart container:
```bash
docker-compose down
docker-compose up -d
```

## Security Recommendations

**Current Issues**:
- Weak password ("password")
- No SSL/TLS encryption
- No connection IP restrictions
- Default user "postgres"

**Production Checklist**:
- [ ] Use strong passwords
- [ ] Enable SSL/TLS (require sslmode=require)
- [ ] Create application-specific user (not postgres)
- [ ] Restrict network access
- [ ] Enable audit logging
- [ ] Regular backups
- [ ] Use environment variables for credentials
- [ ] Implement connection encryption