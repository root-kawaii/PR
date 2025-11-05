# Development Setup

Complete guide to setting up the Pierre Two development environment.

## Prerequisites

### Required Software

- **Node.js**: v18+ ([Download](https://nodejs.org/))
- **Rust**: Latest stable ([Install](https://rustup.rs/))
- **Docker**: Latest ([Download](https://www.docker.com/products/docker-desktop))
- **PostgreSQL Client** (optional): For database management
- **iOS Simulator** (macOS only): For iOS development
- **Android Studio** (optional): For Android development

### Verify Installations

```bash
# Node.js
node --version  # Should be v18+
npm --version

# Rust
rustc --version
cargo --version

# Docker
docker --version
docker-compose --version
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd PR
```

### 2. Start Database

```bash
cd DB
./start.sh
```

This will automatically:
- Start PostgreSQL in Docker
- Run all database migrations
- Display connection details

For a fresh start (clean database):
```bash
./start.sh --fresh
```

### 3. Start Backend

```bash
cd rust_BE

# Set environment variable
export STRIPE_SECRET_KEY=your_stripe_secret_key

# Install dependencies and run
cargo build
cargo run

# Server starts on http://127.0.0.1:3000
```

### 4. Start Frontend

```bash
cd pierre_two

# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Options:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Scan QR code with Expo Go app on physical device
```

---

## Detailed Setup

### Database Setup

#### Using Docker with Automatic Migrations (Recommended)

```bash
cd DB

# Start PostgreSQL with automatic migrations
./start.sh

# Or for a fresh start (clean database)
./start.sh --fresh
```

The startup script will:
- Check Docker is running
- Start PostgreSQL container
- Automatically execute all SQL files in the `migrations/` folder
- Wait for the database to be ready
- Display connection details

**Adding New Migrations:**
1. Create a new `.sql` file in `DB/migrations/` folder
2. Use numbered prefix: `003_add_users_table.sql`
3. Restart with `./start.sh --fresh` to apply

**Manual Docker Compose:**
```bash
# If you prefer manual control
docker-compose up -d

# Check logs
docker-compose logs -f postgres

# Connect to database
docker exec -it postgres-dev-pierre psql -U postgres -d events
```

#### Manual PostgreSQL Installation

If you prefer local PostgreSQL without Docker:

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb events

# Run schema files
psql events < DB/events.sql
psql events < DB/payments.sql
```

Update connection string in backend:
```rust
// In rust_BE/src/main.rs
let pool = PgPoolOptions::new()
    .max_connections(5)
    .connect("postgresql://localhost:5432/events")  // Remove user:password
    .await
    .expect("Failed to connect to Postgres");
```

---

### Backend Setup

#### 1. Install Rust Dependencies

```bash
cd rust_BE

# Build project (downloads dependencies)
cargo build

# This may take a few minutes on first run
```

#### 2. Configure Environment

Create `.env` file in `rust_BE/`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/events
STRIPE_SECRET_KEY=sk_test_your_stripe_key_here
RUST_LOG=info
```

Load environment in code:
```rust
// Add to main.rs
use dotenv::dotenv;

#[tokio::main]
async fn main() {
    dotenv().ok();
    // ... rest of code
}
```

Add to `Cargo.toml`:
```toml
[dependencies]
dotenv = "0.15"
```

#### 3. Run Backend

```bash
cargo run

# Or with hot reload (install cargo-watch)
cargo install cargo-watch
cargo watch -x run
```

#### 4. Test Backend

```bash
# In another terminal
curl http://127.0.0.1:3000/events

# Should return empty array: []
```

---

### Frontend Setup

#### 1. Install Dependencies

```bash
cd pierre_two

npm install

# If you encounter issues, try:
npm install --legacy-peer-deps
```

#### 2. Configure API Endpoint

Update API URL in `hooks/useEvents.tsx`:

```typescript
// For iOS simulator
const API_URL = 'http://127.0.0.1:3000';

// For Android emulator
const API_URL = 'http://10.0.2.2:3000';

// For physical device (use your computer's IP)
const API_URL = 'http://192.168.1.XXX:3000';
```

To find your IP:
```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

#### 3. Start Expo

```bash
npx expo start

# Or with specific options
npx expo start --ios
npx expo start --android
npx expo start --web
```

#### 4. iOS Simulator Setup (macOS)

```bash
# Install Xcode from App Store

# Install command line tools
xcode-select --install

# Install iOS simulator
# Open Xcode > Preferences > Components > Install simulators

# Run app
npx expo start --ios
```

#### 5. Android Emulator Setup

```bash
# Install Android Studio
# Configure Android SDK via Android Studio

# Create emulator via Android Studio

# Run app
npx expo start --android
```

#### 6. Physical Device Testing

1. Install Expo Go app on your device:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Ensure device is on same WiFi network

3. Start Expo and scan QR code:
```bash
npx expo start
```

---

## Stripe Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for free account
3. Navigate to Developers > API Keys

### 2. Get API Keys

Copy your **Secret Key** (starts with `sk_test_`)

### 3. Configure Backend

```bash
# Set environment variable
export STRIPE_SECRET_KEY=sk_test_your_key_here

# Or add to .env file
echo "STRIPE_SECRET_KEY=sk_test_your_key_here" >> rust_BE/.env
```

### 4. Test Stripe Integration

```bash
curl -X POST http://127.0.0.1:3000/payments \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user_123",
    "receiver_id": "venue_456",
    "amount": 50.00
  }'
```

---

## Development Workflow

### Typical Development Session

1. **Start Services**:
```bash
# Terminal 1: Database
cd DB && ./start.sh

# Terminal 2: Backend
cd rust_BE && cargo run

# Terminal 3: Frontend
cd pierre_two && npx expo start
```

2. **Make Changes**:
   - Backend changes require restart (`cargo run`)
   - Frontend changes hot-reload automatically
   - Database schema changes require migration

3. **Test Changes**:
   - Backend: Use cURL or Postman
   - Frontend: View in simulator/device

4. **Commit Changes**:
```bash
git add .
git commit -m "Description of changes"
git push
```

---

## Troubleshooting

### Database Connection Issues

**Error**: `connection refused at localhost:5432`

```bash
# Check if Docker is running
docker ps

# Restart database
cd DB
docker-compose restart

# Check logs
docker-compose logs postgres
```

### Backend Won't Start

**Error**: `Failed to connect to Postgres`

```bash
# Verify database is running
docker ps | grep postgres

# Test connection
psql postgresql://postgres:password@localhost:5432/events

# Check environment variables
echo $DATABASE_URL
```

### Frontend Can't Reach Backend

**Error**: `Network request failed`

1. Check backend is running:
```bash
curl http://127.0.0.1:3000/events
```

2. Update API URL based on device:
   - iOS Simulator: `http://127.0.0.1:3000`
   - Android Emulator: `http://10.0.2.2:3000`
   - Physical Device: `http://<YOUR_IP>:3000`

3. Ensure firewall allows connections on port 3000

### Expo Build Issues

**Error**: `Unable to resolve module`

```bash
# Clear cache and reinstall
cd pierre_two
rm -rf node_modules
npm cache clean --force
npm install

# Clear Expo cache
npx expo start -c
```

### Rust Compilation Errors

**Error**: `linker 'cc' not found`

```bash
# macOS
xcode-select --install

# Linux (Ubuntu/Debian)
sudo apt-get install build-essential

# Windows
# Install Visual Studio Build Tools
```

---

## IDE Setup

### VS Code (Recommended)

**Extensions**:
- Rust Analyzer
- React Native Tools
- Expo Tools
- ESLint
- Prettier
- SQLTools
- Docker

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "rust-analyzer.check.command": "clippy",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## Useful Commands

### Database
```bash
# Connect to database
docker exec -it events_postgres psql -U postgres -d events

# Backup database
docker exec events_postgres pg_dump -U postgres events > backup.sql

# Restore database
docker exec -i events_postgres psql -U postgres events < backup.sql

# Reset database
docker-compose down -v && docker-compose up -d
```

### Backend
```bash
# Run with logs
RUST_LOG=debug cargo run

# Run tests
cargo test

# Format code
cargo fmt

# Check for errors
cargo check

# Lint with clippy
cargo clippy
```

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npx expo start

# Clear cache
npx expo start -c

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android

# Build for production
npm run build
```

---

## Next Steps

After setup, you can:

1. **Explore the codebase** - See [Architecture](./02-architecture.md)
2. **Make API calls** - See [API Reference](./06-api-reference.md)
3. **Understand data models** - See [Data Models](./08-data-models.md)
4. **Start coding!** - See [Frontend](./03-frontend.md) and [Backend](./04-backend.md) docs