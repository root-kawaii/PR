# Database Setup with Automatic Migrations

This folder contains the PostgreSQL database setup with automatic migration execution.

## Quick Start

### Start Database (Recommended)

```bash
cd DB
./start.sh
```

This will:
- Start PostgreSQL in Docker
- Automatically run all migrations in the `migrations/` folder
- Display connection details when ready

### Fresh Start (Clean Database)

```bash
./start.sh --fresh
```

This will:
- Remove all existing data
- Start PostgreSQL from scratch
- Run all migrations

### Manual Docker Compose

```bash
docker-compose up -d
```

## How It Works

1. **Docker Compose** starts the PostgreSQL 16 container
2. **Init Script** (`init-db.sh`) runs automatically on first startup
3. **Migrations** in the `migrations/` folder are executed in alphabetical order
4. **Healthcheck** ensures the database is ready before marking as healthy

## Folder Structure

```
DB/
├── docker-compose.yaml      # Docker configuration
├── start.sh                 # Convenient startup script
├── init-db.sh              # Automatic migration runner
├── migrations/              # SQL migration files
│   ├── 001_create_events_table.sql
│   └── 002_create_payments_table.sql
└── README.md               # This file
```

## Adding New Migrations

1. Create a new SQL file in the `migrations/` folder
2. Use a numbered prefix for ordering (e.g., `003_add_users_table.sql`)
3. Restart the database with `--fresh` flag to apply

**Example migration file:**

```sql
-- migrations/003_add_users_table.sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Naming Convention:**
- `001_description.sql` - Initial tables
- `002_description.sql` - Additional tables
- `003_description.sql` - Alterations
- etc.

## Connection Details

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `events`
- **Username**: `postgres`
- **Password**: `password`
- **Connection String**: `postgresql://postgres:password@localhost:5432/events`

## Useful Commands

### View Logs
```bash
docker-compose logs -f
```

### Stop Database
```bash
docker-compose down
```

### Stop and Remove Data
```bash
docker-compose down -v
```

### Connect with psql
```bash
docker exec -it postgres-dev-pierre psql -U postgres -d events
```

Or with local psql client:
```bash
psql postgresql://postgres:password@localhost:5432/events
```

### Check Database Status
```bash
docker exec postgres-dev-pierre pg_isready -U postgres
```

### View Tables
```bash
docker exec -it postgres-dev-pierre psql -U postgres -d events -c "\dt"
```

## Troubleshooting

### Port Already in Use

If you see "port 5432 already in use":

```bash
# Check what's using the port
lsof -i :5432

# Stop local PostgreSQL if running
brew services stop postgresql
```

### Migrations Not Running

If migrations don't execute:

1. Check the init script has execute permissions:
   ```bash
   chmod +x init-db.sh
   ```

2. Restart with fresh data:
   ```bash
   ./start.sh --fresh
   ```

3. Check logs for errors:
   ```bash
   docker-compose logs postgres
   ```

### Container Won't Start

```bash
# Remove everything and start fresh
docker-compose down -v
docker system prune -f
./start.sh --fresh
```

### Can't Connect from Backend

Make sure you're using the correct connection string:

```rust
// In rust_BE/src/main.rs
let pool = PgPoolOptions::new()
    .max_connections(5)
    .connect("postgresql://postgres:password@localhost:5432/events")
    .await
    .expect("Failed to connect to Postgres");
```

## Important Notes

- **First Startup**: Migrations only run on first container creation
- **Data Persistence**: Data is stored in a Docker volume (`postgres-data`)
- **Fresh Start Required**: To re-run migrations, use `./start.sh --fresh`
- **Network Mode**: Using `host` mode for easy localhost access

## Production Considerations

For production deployment, consider:

- [ ] Use environment variables for credentials
- [ ] Use a migration framework (e.g., SQLx migrations)
- [ ] Remove sample data inserts
- [ ] Enable SSL/TLS
- [ ] Use managed database service
- [ ] Implement proper backup strategy
- [ ] Add migration rollback capability