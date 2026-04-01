# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pierre Two is a nightclub/event booking mobile app. Users can browse events, reserve tables, and purchase tickets. Club owners have a separate dashboard to manage their venue, events, and reservations including QR-code-based check-in.

## Repository Structure

```
pierre_two/       — React Native mobile app (Expo Router, TypeScript)
pierre_dashboard/ — Club owner web dashboard (React + Vite + Tailwind)
rust_BE/          — Rust HTTP API (Axum + SQLx + Tokio)
DB/               — PostgreSQL via Docker with numbered SQL migrations
docs/             — Architecture and API reference documentation
```

## Commands

### Database (start first)
```bash
cd DB && ./start.sh          # Start Postgres in Docker + run all migrations
cd DB && ./start.sh --fresh  # Fresh DB (drops all data)
docker exec -it postgres-dev-pierre psql -U postgres -d events  # Connect
```

### Backend
```bash
cd rust_BE
cargo run                    # Start server on :3000
cargo watch -x run           # Hot reload (requires cargo-watch)
cargo check                  # Fast compile check
cargo clippy                 # Lint
cargo fmt                    # Format
cargo test                   # Run tests
RUST_LOG=debug cargo run     # Verbose logging
```

Required `rust_BE/.env`:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/events
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=your-secret
STRIPE_WEBHOOK_SECRET=whsec_...   # optional in dev
```

### Mobile app (pierre_two)
```bash
cd pierre_two
npm install
npx expo start               # Start dev server
npx expo start --ios         # iOS simulator
npx expo start --android     # Android emulator
npx expo start -c            # Clear Metro cache
expo lint                    # Lint
```

### Dashboard (pierre_dashboard)
```bash
cd pierre_dashboard
npm install
npm run dev                  # Start dev server (Vite, default :5173)
npm run build                # Production build
npm run lint                 # Lint
```

Optional `pierre_dashboard/.env`:
```
VITE_API_URL=http://localhost:3000   # defaults to this if unset
```

## Architecture

### Backend (rust_BE/src/)

Layered MVC — all routes are registered in `main.rs`, no magic routing:

```
main.rs            — Router setup, AppState initialization, middleware wiring
controllers/       — HTTP handlers; extract request, call persistence, return JSON
persistences/      — All SQLx queries; one file per entity
models/            — Serde structs for DB rows and request/response bodies
middleware/        — Auth extractors: AuthUser (any JWT) and ClubOwnerUser (role="club_owner")
services/          — SMS via Twilio (sms_service.rs)
idempotency/       — Deduplication for payment mutations
logging/           — Structured JSON logging via tracing
utils/jwt.rs       — JWT encode/decode
```

`AppState` (shared via `Arc<AppState>`) holds: `db_pool`, `stripe_client`, `jwt_secret`, `idempotency_service`, `stripe_webhook_secret`.

Auth is handled by Axum extractors — add `AuthUser` or `ClubOwnerUser` as a handler parameter to protect a route. Owner-scoped routes live under `/owner/`.

### Mobile app (pierre_two/)

```
app/               — Expo Router file-based screens
app/(tabs)/        — Tab navigator: index (home), search, tickets, reservations, profile
context/           — AuthContext (JWT + AsyncStorage), ThemeContext
hooks/             — Per-entity data hooks (useClubs, useTickets, etc.)
components/        — Organized by feature: home/, event/, reservation/, settings/
config/api.ts      — API_URL resolution (simulator vs. device vs. production)
types/index.ts     — All shared TypeScript types
```

API base URL is resolved dynamically in `config/api.ts`. For a physical device on a local network, update the IP returned there.

### Dashboard (pierre_dashboard/)

Web app for club owners. Built with React + React Router v7 + Tailwind CSS v4, bundled with Vite.

```
src/App.tsx            — Route definitions (BrowserRouter + ProtectedRoute wrapper)
src/context/           — AuthContext: stores token + owner + club in localStorage
src/hooks/useFetch.ts  — Generic authenticated GET hook; exposes data/loading/error/refetch
src/pages/             — One file per route
src/config/api.ts      — API_URL from VITE_API_URL env var, falls back to localhost:3000
src/types/index.ts     — All shared TypeScript types
```

**Pages and their backend endpoints:**

| Page | Route | Backend |
|---|---|---|
| `DashboardPage` | `/dashboard` | `GET /owner/club`, `GET /owner/stats` |
| `EventsPage` | `/dashboard/events` | `GET /owner/events`, `POST /owner/events` |
| `EventTablesPage` | `/dashboard/events/:id/tables` | `GET /owner/events/:id/tables`, `POST /owner/events/:id/tables` |
| `EventReservationsPage` | `/dashboard/events/:id/reservations` | `GET /owner/events/:id/reservations` |
| `ClubSettingsPage` | `/dashboard/club` | `GET /owner/club`, `PUT /owner/club` |
| `QRScannerPage` | `/dashboard/scan` | `GET /owner/scan/:code`, `POST /owner/checkin/:code` |

Auth uses `POST /auth/club-owner/login` (role `club_owner`). The JWT is stored in `localStorage` and attached as `Authorization: Bearer <token>` by `useFetch` and any manual `fetch` calls in pages.

The QR scanner page supports both camera scanning (via `html5-qrcode`, dynamically imported) and manual code entry. It resolves codes for both tickets and table reservations.

### Database

Migrations live in `DB/migrations/` with numeric prefixes (`001_`, `002_`, ...). Always add new migrations as the next numbered file — never edit existing ones. The Docker init script runs them in order on first start; use `./start.sh --fresh` to re-apply everything.

### Key Domain Entities

- **Event** — club night with date, capacity, ticket/table options
- **Club** — venue; owned by a `club_owner` user
- **Ticket** — entry ticket for an event; has a unique code for QR scanning
- **TableReservation** — table booking linked to a Stripe PaymentIntent (authorize-then-capture flow)
- **Payment** — Stripe PaymentIntent wrapper stored in DB

### Payment Flow

Reservations use Stripe's authorize-then-capture pattern: `/reservations/create-with-payment` creates the PaymentIntent and reservation atomically. Capture happens at check-in or manually via `/payments/:id/capture`. Stripe webhooks arrive at `/stripe/webhooks` (signature-verified).

### Idempotency

Payment mutations accept an `Idempotency-Key` header. The `IdempotencyService` stores request fingerprints and cached responses in the `idempotency_keys` table; an hourly Tokio task cleans expired records.

## Workflow

### Before committing
Always propose updating (or creating) the daily progress log in `docs/daily-progress/` before creating a git commit. File name format: `YYYY-MM-DD-<short-slug>.md`. Follow the structure of existing files in that folder: Overview → Changes grouped by layer (Backend / Dashboard / Mobile / Database) → Files Modified table.
