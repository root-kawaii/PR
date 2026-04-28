# Local Setup Guide for New Developers

Step-by-step guide to get the backend running on your machine, connected to the shared Supabase database.

## Prerequisites

Install the following:

| Tool | Version | Install |
|------|---------|---------|
| Rust | Latest stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js | v18+ | [nodejs.org](https://nodejs.org/) (only needed for frontend) |

Verify:

```bash
rustc --version
cargo --version
```

> **macOS users**: You also need Xcode command line tools: `xcode-select --install`

---

## Step 1: Clone the Repo

```bash
git clone <repo-url>
cd PR
```

---

## Step 2: Configure the Backend

```bash
cd rust_BE
cp .env.example .env
```

Edit `rust_BE/.env` and fill in the shared staging credentials (ask the team lead for these):

```env
# Shared staging Supabase database -- no local DB setup needed
DATABASE_URL=postgresql://postgres.cnvnugirbftyblxnkqbf:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# Server config
HOST=0.0.0.0
PORT=3000
APP_BASE_URL=http://127.0.0.1:3000
OWNER_APP_BASE_URL=http://127.0.0.1:5173

# JWT signing key (use the same one as the team so tokens are compatible)
JWT_SECRET=<ask-team-lead>

# Stripe test key (shared across the team)
STRIPE_SECRET_KEY=sk_test_<ask-team-lead>

# Twilio (shared across the team)
TWILIO_ACCOUNT_SID=<ask-team-lead>
TWILIO_AUTH_TOKEN=<ask-team-lead>
TWILIO_VERIFY_SERVICE_SID=<ask-team-lead>
TWILIO_PHONE_NUMBER=<ask-team-lead>

# Optional: Apple App Review-only SMS bypass.
# Keep this disabled unless you're actively preparing an App Store review build.
APP_REVIEW_BYPASS_ENABLED=false
APP_REVIEW_BYPASS_CODE=
APP_REVIEW_BYPASS_PHONE_NUMBERS=
```

> **The simplest option**: Ask the team lead to send you the `rust_BE/.env` file for local development. It should keep the backend local while pointing `DATABASE_URL` at staging.

---

## Step 3: Build and Run the Backend

```bash
cd rust_BE

# First build (downloads and compiles ~200+ crates, takes a few minutes)
cargo build

# Run the server
cargo run
```

The server starts on `http://127.0.0.1:3000`.

**Verify it works:**

```bash
curl http://127.0.0.1:3000/events
```

You should see the same events data that's in the shared database.

---

## Step 4: Test the API

```bash
# List events
curl http://127.0.0.1:3000/events

# List clubs
curl http://127.0.0.1:3000/clubs

# List genres
curl http://127.0.0.1:3000/genres

# Register a test user
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "first_name": "Test",
    "last_name": "User",
    "phone_number": "+1234567890"
  }'

# Login
curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

The login response returns a JWT token. Use it for authenticated endpoints:

```bash
curl http://127.0.0.1:3000/tickets \
  -H "Authorization: Bearer <your-jwt-token>"
```

See [06-api-reference.md](06-api-reference.md) for the full list of 40+ endpoints.

---

## Day-to-Day Development

### Starting the backend

```bash
cd rust_BE && cargo run
```

That's it -- the database is already running on the staging Supabase project.

### Hot reload

```bash
cargo install cargo-watch
cargo watch -x run
```

Automatically restarts the server when you save a Rust file.

### Backend with debug logs

```bash
RUST_LOG=debug cargo run
```

---

## Connecting the Frontend to Local Backend

To test the mobile app or dashboard against your local backend instead of the deployed one:

**Mobile app** -- edit `pierre_two/.env`, or use the helper scripts:

```bash
cd pierre_two
npm run start:local-ios
# or
npm run start:local-android
```

If you need to edit the env file manually:
```env
# iOS Simulator
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000

# Android Emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# Physical device (use your machine's local IP)
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

**Dashboard** -- edit `pierre_dashboard/.env`:
```env
VITE_API_URL=http://127.0.0.1:3000
```

Then start the frontend:
```bash
# Mobile app
cd pierre_two && npm install && npx expo start

# Dashboard
cd pierre_dashboard && npm install && npm run dev
```

---

## Important: Shared Database

Since everyone connects to the same Supabase database:

- **Data is shared** -- records you create are visible to everyone else
- **Be careful with destructive operations** -- don't drop tables or delete data others depend on
- **Use test data** -- prefix test records so they're easy to identify (e.g., `test-user@example.com`)
- **Database migrations** -- coordinate with the team before running new migrations. They go through CI/CD on push to main

---

## Troubleshooting

### "Failed to connect to Postgres"
- Check your internet connection (Supabase is a remote database)
- Verify the `DATABASE_URL` in your `.env` is correct
- Make sure the Supabase project is active (free tier pauses after inactivity)

### "linker 'cc' not found" (Rust build error)
```bash
# macOS
xcode-select --install

# Linux (Ubuntu/Debian)
sudo apt-get install build-essential
```

### Backend compiles but panics on startup
- Check that `rust_BE/.env` exists and has all required values
- Make sure you copied credentials correctly (no trailing spaces)

### Stripe/payment endpoints return errors
- Verify `STRIPE_SECRET_KEY` starts with `sk_test_`
- Make sure you're using the team's shared test key

### Can't reach backend from mobile app
- Check the `EXPO_PUBLIC_API_URL` is set to the right address for your setup
- Ensure your firewall allows connections on port 3000
- For physical devices, your phone must be on the same WiFi network
