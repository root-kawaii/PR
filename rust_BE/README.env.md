# Environment Variables Setup

## Quick Start

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Start the local Postgres container from the repo root:
   ```bash
   docker compose up -d postgres
   ```

3. Fill in your actual credentials in `.env`

The recommended local setup on `develop` is:

- mobile app -> local backend on `http://127.0.0.1:3000`
- local backend -> local Docker Postgres on `127.0.0.1:5433`

The backend can now auto-apply every SQL file in `DB/migrations/` on startup when
`AUTO_RUN_DB_MIGRATIONS=true` (enabled in `.env.example`).

## One-command local start

From the repo root you can now use:

```bash
bash scripts/dev-local.sh ios
```

This `ios` mode boots the iOS Simulator and opens the Expo app against the local backend.
If the Expo dev build is not installed yet, the script now runs `npx expo run:ios`
first to install it into the simulator automatically.

Other modes:

```bash
bash scripts/dev-local.sh android
bash scripts/dev-local.sh app
bash scripts/dev-local.sh backend
bash scripts/dev-local.sh db
```

The recommended local setup on `develop` is:

- mobile app -> local backend on `http://127.0.0.1:3000`
- local backend -> remote staging Supabase database

That is why `.env.example` is written around the staging pooler host but keeps the password as a local-only placeholder.

## Required Variables

### Database
- **DATABASE_URL**: PostgreSQL connection string
  - Recommended local format: `postgresql://postgres:postgres@127.0.0.1:5433/pierre_local`
- **AUTO_RUN_DB_MIGRATIONS**: Automatically apply `DB/migrations/*.sql` at backend startup
  - Recommended local value: `true`
  - Keep `false` in deployed environments unless you intentionally want startup migrations
  - Recommended local format: `postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres`
  - Use the staging Supabase pooler credentials for day-to-day development

### Server
- **HOST**: Server host (default: `0.0.0.0`)
- **PORT**: Server port (default: `3000`)
- **APP_BASE_URL**: use `http://127.0.0.1:3000` for local backend development
- **OWNER_APP_BASE_URL**: use `http://127.0.0.1:5173` if you want local dashboard callbacks

### Stripe
- **STRIPE_SECRET_KEY**: Your Stripe secret key
  - Get from: https://dashboard.stripe.com/apikeys
  - Use test key (starts with `sk_test_`) for development

### JWT
- **JWT_SECRET**: Secret key for JWT token generation
  - Generate a random string (min 32 characters)
  - Example: `openssl rand -base64 32`

### Twilio (Optional)
- **TWILIO_ACCOUNT_SID**: Your Twilio Account SID
- **TWILIO_AUTH_TOKEN**: Your Twilio Auth Token
- **TWILIO_VERIFY_SERVICE_SID**: Your Twilio Verify Service SID

Get these from: https://console.twilio.com/

**Note**: If these are not set, the app will run in development mode and accept verification code '123456' for testing.

## Security Notes

⚠️ **IMPORTANT**:
- Never commit the `.env` file to version control
- Never share your `.env` file or credentials
- Use different credentials for development and production
- Rotate secrets regularly

The `.env` file is already in `.gitignore` and will not be tracked by git.
