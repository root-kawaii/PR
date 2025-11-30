#!/bin/bash
# Run a specific migration against the database specified in DATABASE_URL

if [ -z "$1" ]; then
    echo "Usage: ./run-migration.sh <migration-file>"
    echo "Example: ./run-migration.sh migrations/020_add_phone_verification.sql"
    exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep DATABASE_URL | xargs)
elif [ -f ".env" ]; then
    export $(cat .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    echo "   Please set DATABASE_URL in your .env file"
    exit 1
fi

echo "🚀 Running migration: $(basename $MIGRATION_FILE)"
echo "📦 Database: $DATABASE_URL"
echo ""

# Use docker with postgres image to run psql
docker run --rm -i postgres:15 psql "$DATABASE_URL" < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
else
    echo ""
    echo "❌ Migration failed"
    exit 1
fi
