#!/bin/bash
set -e

echo "🚀 Starting database initialization..."
echo "📦 Running database migrations..."

# Check if migrations directory exists and has SQL files
if [ -d "/docker-entrypoint-initdb.d/migrations" ] && [ -n "$(ls -A /docker-entrypoint-initdb.d/migrations/*.sql 2>/dev/null)" ]; then
    for migration in /docker-entrypoint-initdb.d/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "   Executing: $(basename "$migration")"
            psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
            echo "   ✓ Completed: $(basename "$migration")"
        fi
    done
else
    echo "   ⚠️  No migration files found in /docker-entrypoint-initdb.d/migrations/"
fi

echo "✅ Database migrations completed successfully!"
echo "🎉 Database is ready to use!"