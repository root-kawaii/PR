#!/bin/bash

# Run all pending Supabase migrations
# Usage: ./run-all-migrations.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🗃️  Supabase Migration Runner"
echo "================================"
echo ""

# Load environment variables
if [ -f "../rust_BE/.env" ]; then
    export $(cat ../rust_BE/.env | grep DATABASE_URL | xargs)
elif [ -f ".env" ]; then
    export $(cat .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ Error: DATABASE_URL not found in .env${NC}"
  exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Error: docker command not found${NC}"
  echo "Please install Docker"
  exit 1
fi

cd migrations

# Create schema_migrations table if it doesn't exist
echo "📋 Checking schema_migrations table..."
echo "CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);" | docker run --rm -i postgres:15 psql "$DATABASE_URL" > /dev/null 2>&1

# Get list of migration files
MIGRATION_FILES=$(ls -1 *.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
  echo -e "${YELLOW}⚠️  No migration files found${NC}"
  exit 0
fi

# Get already applied migrations
APPLIED_MIGRATIONS=$(echo "SELECT migration_name FROM schema_migrations ORDER BY migration_name;" | docker run --rm -i postgres:15 psql "$DATABASE_URL" -t 2>/dev/null || echo "")

# Find and run pending migrations
PENDING_COUNT=0
APPLIED_COUNT=0

for migration in $MIGRATION_FILES; do
  if echo "$APPLIED_MIGRATIONS" | grep -q "$migration"; then
    echo -e "  ⏭️  ${migration} (already applied)"
    ((APPLIED_COUNT++))
  else
    echo -e "${YELLOW}  ▶️  Running: ${migration}${NC}"

    # Run migration
    if docker run --rm -i postgres:15 psql "$DATABASE_URL" < "$migration" > /dev/null 2>&1; then
      # Record migration as applied
      echo "INSERT INTO schema_migrations (migration_name) VALUES ('$migration');" | docker run --rm -i postgres:15 psql "$DATABASE_URL" > /dev/null 2>&1

      echo -e "${GREEN}  ✅ ${migration} completed${NC}"
      ((PENDING_COUNT++))
    else
      echo -e "${RED}  ❌ ${migration} failed${NC}"
      exit 1
    fi
  fi
done

echo ""
echo "================================"
echo -e "${GREEN}✅ Migration completed${NC}"
echo "  Previously applied: $APPLIED_COUNT"
echo "  Newly applied: $PENDING_COUNT"
echo "  Total migrations: $((APPLIED_COUNT + PENDING_COUNT))"
