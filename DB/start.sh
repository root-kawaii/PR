#!/bin/bash

echo "🐘 Starting Pierre Two Database..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Stop and remove existing container (if any)
echo "🧹 Cleaning up existing containers..."
docker-compose down

# Remove the volume if --fresh flag is passed
if [ "$1" == "--fresh" ]; then
    echo "🗑️  Removing existing data (fresh start)..."
    docker-compose down -v
fi

# Start the database
echo "🚀 Starting PostgreSQL with automatic migrations..."
docker-compose up -d

# Wait for healthcheck
echo "⏳ Waiting for database to be ready..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker exec postgres-dev-pierre pg_isready -U postgres > /dev/null 2>&1; then
        echo ""
        echo "✅ Database is ready!"
        echo ""
        echo "📊 Connection Details:"
        echo "   Host: localhost"
        echo "   Port: 5432"
        echo "   Database: events"
        echo "   Username: postgres"
        echo "   Password: password"
        echo ""
        echo "🔗 Connection String:"
        echo "   postgresql://postgres:password@localhost:5432/events"
        echo ""
        echo "📝 To view logs:"
        echo "   docker-compose logs -f"
        echo ""
        echo "🛑 To stop:"
        echo "   docker-compose down"
        echo ""
        exit 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
done

echo ""
echo "❌ Timeout waiting for database to be ready"
echo "   Check logs with: docker-compose logs"
exit 1