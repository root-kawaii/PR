# Pierre — Project Reference

## Directories

| Path | Purpose |
|------|---------|
| `rust_BE/` | Axum 0.7 + SQLx backend — deployed to Fly.io |
| `pierre_two/` | React Native / Expo Router mobile app |
| `pierre_dashboard/` | React + Vite club-owner dashboard |
| `DB/migrations/` | Numbered SQL migration files (run on Supabase) |

## Backend Conventions (`rust_BE/`)

**Layer order:** `models/` → `persistences/` → `controllers/` — never skip layers.

**Error responses** — always use the `ApiError` envelope with Italian messages:
```rust
return Err(crate::models::ApiError::new(StatusCode::CONFLICT, "Messaggio in italiano"));
```

**Auth extractors:**
- User JWT: `AuthUser(claims): AuthUser` (from `middleware/auth.rs`)
- Club owner JWT: same extractor, role check inside handler
- No auth needed: payment link routes (`/payment-links/:token/*`) and webhook

**Adding a route:** register handler in `src/main.rs` → `create_router()`; add model structs to `src/models/`, add DB query to `src/persistences/`, implement logic in `src/controllers/`.

## Split Payment Model

- Owner reserves table → pays `total_cost / capacity` → gets `payment_link_token` on `table_reservations`
- Guests open `/payment-links/:token` → submit name + phone + email → Stripe Checkout
- Slot claiming is race-safe: `SELECT FOR UPDATE` on reservation row → count active shares → check duplicate phone → insert `checkout_pending` → all in one transaction
- Stripe webhook at `/stripe/webhooks` updates share to `paid`, increments `num_people`, auto-confirms reservation when `amount_paid >= total_amount`
- **Phone = unique consumer ID**: no two users share a phone; no two active payment shares on the same reservation share a phone

## DB Migrations

```bash
# Run a migration
/opt/homebrew/bin/psql $DATABASE_URL -f DB/migrations/<file>.sql

# Next migration number: look at the highest file in DB/migrations/
ls DB/migrations/*.sql | sort | tail -1
```

File naming: `NNN_snake_case_description.sql` (zero-padded, e.g. `037_...`).

Partial unique index pattern for payment shares:
```sql
WHERE phone_number IS NOT NULL AND is_owner = false AND status IN ('paid', 'checkout_pending')
```

## Compile & Deploy

```bash
# Compile check (run after any Rust edit)
cd rust_BE && cargo check

# Deploy backend to Fly.io
cd rust_BE && fly deploy
```

Backend URL: `https://pierre-two-backend.fly.dev`

## Key Env Vars (`rust_BE/.env`)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Supabase Postgres connection string |
| `JWT_SECRET` | Minimum 32 chars; signs user + club owner tokens |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe HMAC secret for webhook verification |
| `APP_BASE_URL` | Used for Stripe Checkout redirect URLs |
| `PAYMENT_SHARE_TTL_HOURS` | How long a guest has to pay (default 48h) |

## Local Command Docs

| Command | What it does |
|---------|-------------|
| `/cargo-check` | Run `cargo check` in `rust_BE` and report compiler issues |
| `/deploy-backend` | Compile-check then `fly deploy` |
| `/new-migration` | Scaffold the next numbered migration file |
| `/run-migration` | Run a specific migration file on Supabase |
