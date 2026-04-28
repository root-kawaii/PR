# Running the Marzipano Migration

## Migration File
`DB/migrations/025_add_marzipano_support.sql`

## Option 1: Using psql (Command Line)

```bash
# Connect to your database and run the migration
psql postgresql://user:password@host:port/database -f DB/migrations/025_add_marzipano_support.sql

# Example:
psql postgresql://postgres:password@localhost:5432/events -f DB/migrations/025_add_marzipano_support.sql
```

## Option 2: Using TablePlus (GUI)

1. Open TablePlus
2. Connect to your database
3. Click "SQL" button (top toolbar)
4. Copy contents of `025_add_marzipano_support.sql`
5. Paste into SQL editor
6. Click "Run" (⌘+Enter)

## Option 3: Using pgAdmin (GUI)

1. Open pgAdmin
2. Navigate to your database
3. Right-click → "Query Tool"
4. Open `025_add_marzipano_support.sql`
5. Click "Execute" (F5)

## Option 4: Using Docker (if database is in Docker)

```bash
# Copy migration file into container
docker cp DB/migrations/025_add_marzipano_support.sql postgres-container:/tmp/

# Execute migration
docker exec -i postgres-container psql -U postgres -d events -f /tmp/025_add_marzipano_support.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check that columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('marzipano_config', 'tour_provider', 'tour_id');

-- Should return:
-- marzipano_config | jsonb
-- tour_provider    | character varying
-- tour_id          | character varying

-- Check tables columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tables'
AND column_name = 'marzipano_position';

-- Should return:
-- marzipano_position | jsonb

-- Check indexes were created
SELECT indexname FROM pg_indexes
WHERE tablename IN ('events', 'tables')
AND indexname LIKE '%marzipano%';

-- Should return:
-- idx_events_marzipano_config
-- idx_tables_marzipano_position
```

## Rollback (if needed)

If you need to undo the migration:

```sql
-- Remove columns
ALTER TABLE events DROP COLUMN IF EXISTS marzipano_config;
ALTER TABLE tables DROP COLUMN IF EXISTS marzipano_position;

-- Indexes will be automatically dropped when columns are dropped
```

## Notes

- Migration is **idempotent** (safe to run multiple times)
- Uses `IF NOT EXISTS` clauses
- **Non-destructive** (only adds, doesn't remove)
- **Backward compatible** (old data preserved)
