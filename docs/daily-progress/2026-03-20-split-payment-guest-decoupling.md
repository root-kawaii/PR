# Daily Progress - March 20, 2026

## Split Payment & Guest Decoupling

### Overview
Decoupled payment from guest count in the table booking system. Previously, one person paid the entire amount (`min_spend * num_people`). Now the table has a fixed cost (`total_cost`), the owner pays their share, payment links are generated for other paying guests, and free guests can be added without any payment.

---

## Problem

The old system tightly coupled payment and guest count:
- `total_amount = min_spend * num_people`
- One person paid everything upfront
- Could not add guests without recalculating payment
- No way to split payments across multiple people

**Desired behavior** (user story):
> I book a table costing 1500 EUR for 3 people. I pay 500 EUR. Two payment links are generated for the other guests (500 EUR each). Later, I add a 4th person for free by entering their phone number.

---

## Database Changes

### Migration 030: `DB/migrations/030_split_payments.sql`

**`reservation_payment_shares`** - tracks each person's slice of the table cost:
- `id`, `reservation_id`, `user_id` (nullable), `phone_number`
- `amount` - this person's share
- `status` - pending / paid / expired / cancelled
- `payment_link_token` - unique opaque token for shareable URL
- `stripe_payment_intent_id`, `stripe_checkout_session_id`
- `payment_id` - linked after successful payment
- `is_owner` - true for the person who booked
- `guest_name`, `guest_email` - provided during anonymous payment

**`reservation_guests`** - non-paying guests added after booking:
- `id`, `reservation_id`, `user_id` (nullable)
- `phone_number`, `email`, `name`
- `added_by` - who added this guest
- `ticket_id` - ticket created for the guest

Indexes on `reservation_id`, `payment_link_token`, `stripe_checkout_session_id`.

---

## API Changes

### Modified Endpoints

#### `POST /reservations/create-payment-intent`

**Before**: Calculated `min_spend * (1 + num_guests)`, created one PaymentIntent for everything.

**After**: Uses fixed `table.total_cost`, split among `num_paying_guests`. Creates PaymentIntent for **owner's share only**.

New request fields: `num_paying_guests`, `paying_guest_phone_numbers`, `contact_name/email/phone`.

Response now includes: `total_cost`, `per_person_amount`, `owner_share`.

Rounding: owner pays remainder (e.g., 1000/3 -> per_person=333.33, owner=333.34).

#### `POST /reservations/create-with-payment`

**Before**: Created reservation + one payment for full amount + tickets for all users.

**After**: Atomic transaction that:
1. Creates reservation with `total_amount = table.total_cost`
2. Creates owner's payment share (status=paid)
3. Creates pending shares for each paying guest with unique `payment_link_token`
4. Creates owner's ticket
5. Optionally adds free guests with their own tickets
6. Returns reservation + array of payment share tokens

### New Endpoints

#### `GET /payment-links/:token`
Public preview of a payment share. Returns limited info: amount, event name, table name, status. No auth required.

#### `POST /payment-links/:token/verify`
Identity verification gate. Guest provides `phone_number` or `email`. Backend matches against the `phone_number` stored on the payment share. Returns a short-lived JWT (1 hour) + full details on success, 403 on mismatch.

#### `POST /payment-links/:token/checkout`
Creates a Stripe Checkout Session. Requires verification JWT from the verify step. Guest provides optional `name`/`email`. Returns `checkout_url` (Stripe-hosted payment page). No app or account needed.

#### `POST /stripe/webhooks` (extended)
Now handles `checkout.session.completed` event:
- Looks up payment share by `stripe_checkout_session_id`
- Creates payment record
- Updates share to `paid`
- Creates ticket for guest
- Increments `table_reservations.amount_paid`
- Auto-confirms reservation when all shares are paid

#### `POST /reservations/:id/add-guest`
Add a free (non-paying) guest by phone number. Validates capacity, creates ticket, updates `num_people`.

#### `GET /reservations/:id/payment-status`
Returns all payment shares + free guests + totals. Used by owner to track who has paid.

---

## Files Modified

| File | Changes |
|------|---------|
| `DB/migrations/030_split_payments.sql` | NEW - two tables + indexes |
| `rust_BE/Cargo.toml` | Added `checkout` feature to `async-stripe` |
| `rust_BE/src/models/table.rs` | 15 new structs (models, requests, responses) |
| `rust_BE/src/models/mod.rs` | Exported new types |
| `rust_BE/src/persistences/table_persistence.rs` | 10 new DB functions for payment shares + guests |
| `rust_BE/src/controllers/table_controller.rs` | Rewrote 2 endpoints, added 5 new handlers |
| `rust_BE/src/controllers/webhook_controller.rs` | Handles `checkout.session.completed` |
| `rust_BE/src/main.rs` | Registered 5 new routes |
| `pierre_two/types/index.ts` | Added `PaymentShare`, `FreeGuest`, `ReservationPaymentStatus` types; extended `TableReservation` |
| `pierre_two/components/reservation/TableReservationModal.tsx` | Rewrote booking flow for split payments (paying vs free guests, owner share only) |
| `pierre_two/components/reservation/TableReservationDetailModal.tsx` | Payment shares list, free guests, add-guest form, share payment links |
| `pierre_two/app/(tabs)/reservations.tsx` | Payment progress bar on cards, removed legacy add-payment flow |

---

## Payment Flow

### Owner booking flow
1. Frontend calls `POST /reservations/create-payment-intent` with `num_paying_guests: 3`
2. Backend returns `client_secret` for owner's share (500 EUR of 1500 EUR table)
3. Frontend completes Stripe payment
4. Frontend calls `POST /reservations/create-with-payment`
5. Backend creates reservation + owner's paid share + 2 pending shares with tokens
6. Owner shares payment links via WhatsApp/SMS

### Guest payment flow
1. Guest opens `https://app.example.com/pay/{token}`
2. Frontend calls `GET /payment-links/{token}` to show preview (amount, event, table)
3. Guest verifies identity with phone number via `POST /payment-links/{token}/verify`
4. Frontend calls `POST /payment-links/{token}/checkout` with verification JWT
5. Guest is redirected to Stripe Checkout hosted page
6. Stripe webhook confirms payment -> ticket created, totals updated

### Adding a free guest
1. Owner calls `POST /reservations/:id/add-guest` with phone number
2. Backend validates capacity, creates ticket, increments `num_people`

---

## Edge Cases Handled

- **Rounding**: Owner absorbs remainder (e.g., 1000/3 = 333.33 + 333.33 + 333.34)
- **Guest never pays**: Share stays `pending`, owner monitors via payment-status endpoint
- **Capacity**: `add-guest` checks total (paying + free) <= `table.capacity`
- **Backward compat**: Old reservations without rows in new tables continue working
- **Identity verification**: Payment links require phone/email match before checkout
- **Anonymous guests**: Stripe Checkout (hosted page) - no app needed, ticket via webhook
- **Checkout expiry**: Stripe sessions expire after 24h by default

---

## Verification Steps

1. Create a table with `total_cost = 1500`, `capacity = 6`
2. Book with 3 paying guests -> owner pays 500, gets 2 payment link tokens
3. Open payment link -> see 500 EUR preview (event name, table)
4. Verify identity with phone number -> get access to pay
5. Guest pays via Stripe Checkout -> ticket created, `amount_paid` = 1000
6. Second guest pays -> `amount_paid` = 1500, reservation confirmed
7. Add 4th person free via phone number -> `num_people` = 4, no payment needed
8. QR check-in still works for all 4 people

---

## Frontend Changes (React Native)

### `types/index.ts`
- Added `PaymentShare` type (id, phoneNumber, amount, status, paymentLinkToken, isOwner, guestName, guestEmail)
- Added `FreeGuest` type (id, phoneNumber, email, name, ticketId, createdAt)
- Added `ReservationPaymentStatus` type (aggregated view)
- Extended `TableReservation` with optional `paymentShares`, `freeGuests`, and `table.totalCost`

### `TableReservationModal.tsx` (booking flow)
- Uses fixed `table.totalCost` instead of `minSpend * numPeople`
- Two separate guest sections: **Paying Guests** (yellow, get payment links) and **Free Guests** (green, no payment)
- Summary shows: table cost, paying people count, free guests, per-person share, and owner's share (with rounding)
- Button text shows exact owner amount: "PAGA €500.00 E PRENOTA"
- Sends `num_paying_guests` + `paying_guest_phone_numbers` + `free_guest_phone_numbers` to the new API
- After booking, displays payment link info for each pending guest share

### `TableReservationDetailModal.tsx` (reservation details)
- Fetches `GET /reservations/:id/payment-status` on open
- **Payment Shares section**: shows each share with status badge (Pagato/In attesa), amount, and share button for pending links
- **Free Guests section**: lists non-paying guests with "Gratis" badge
- **Add Free Guest form**: phone number + optional name, calls `POST /reservations/:id/add-guest`
- Pending payments warning banner with count
- Backward compatible: still shows legacy `participants` if no payment shares exist

### `reservations.tsx` (reservations list)
- Payment progress bar on each reservation card (amount paid / total amount)
- Removed old Stripe-based `handlePaymentSubmit` (payments now via split links)
- Refreshes reservation list when detail modal closes (picks up guest additions)

---

## Delayed Capture & Payment Scheduler (Merged)

Merged `feature/payment-improvement-capture` branch — adds delayed capture so cards are authorized at booking time but only charged the day before the event.

### How It Works

```
User books table
  → PaymentIntent created with capture_method: manual + setup_future_usage: off_session
  → Card is authorized (hold placed), NOT charged
  → stripe_customer_id + stripe_payment_method_id saved on payment record

Daily scheduler (runs at 09:00 UTC):
  For each payment with authorization_status = 'authorized':
    IF event is tomorrow → Capture the PaymentIntent (money taken)
    ELSE IF authorized_at >= 6 days ago → Cancel old PI, create + confirm new one off-session
```

### Database Changes

#### Migration 028: `DB/migrations/028_add_stripe_customer_to_payments.sql`
- Added `stripe_customer_id` and `stripe_payment_method_id` columns to `payments` table
- Enables off-session re-authorization when the 7-day Stripe hold expires

#### Migration 029: `DB/migrations/029_add_event_date_to_events.sql`
- Added `event_date` (DATE) column to `events` table
- Machine-readable date for the scheduler (existing `date` column is a display string like "10 MAG | 23:00")

### API & Backend Changes

| File | Changes |
|------|---------|
| `rust_BE/src/controllers/table_controller.rs` | `create_payment_intent` now creates a Stripe Customer, sets `capture_method: manual` + `setup_future_usage: off_session`; `create_reservation_with_payment` saves `stripe_customer_id` + `stripe_payment_method_id` on payment record |
| `rust_BE/src/controllers/webhook_controller.rs` | New handler for `payment_intent.amount_capturable_updated` — stores `authorized_at` and `payment_method_id` for scheduler re-auth |
| `rust_BE/src/services/payment_scheduler.rs` | NEW — daily background job: captures payments day before event, re-authorizes every 6 days to avoid Stripe's 7-day hold expiry |
| `rust_BE/src/services/mod.rs` | Exports `payment_scheduler` |
| `rust_BE/src/main.rs` | Spawns scheduler as Tokio background task |
| `rust_BE/src/models/event.rs` | Added `event_date: Option<NaiveDate>` to `Event`, `CreateEventRequest`, `UpdateEventRequest` |
| `rust_BE/src/models/payment.rs` | Added `stripe_customer_id`, `stripe_payment_method_id` to `PaymentEntity` |
| `rust_BE/src/persistences/event_persistence.rs` | All queries now include `event_date` column |
| `rust_BE/src/persistences/payment_persistence.rs` | All queries now include `stripe_customer_id`, `stripe_payment_method_id` columns |
| `docs/DELAYED_CAPTURE_PLAN.md` | NEW — full plan document for delayed capture |
| `docs/LOCAL_SETUP_GUIDE.md` | NEW — local dev setup guide |

### Merge Conflicts Resolved

Two conflicts between split payment (this branch) and delayed capture (`feature/payment-improvement-capture`):
1. **`table_controller.rs`** — combined split payment calculation (per-person share, capacity check) with Stripe Customer creation + manual capture params
2. **`webhook_controller.rs`** — kept both `checkout.session.completed` (guest payments) and `payment_intent.amount_capturable_updated` (authorization tracking) handlers

---

## Test Results (End-to-End)

Tested against live Supabase DB + Stripe test mode after merge:

| # | Test | Result |
|---|------|--------|
| 1 | Create split payment intent (500 EUR / 3 people) | Owner share: 166.66 EUR, guests: 166.67 EUR each |
| 2 | Verify Stripe PI: `capture_method=manual`, `setup_future_usage=off_session`, customer created | All confirmed on Stripe |
| 3 | Confirm payment with test card → status `requires_capture` (held, not charged) | Card authorized only |
| 4 | Create reservation with split payment + 1 free guest | 4 people, 3 payment shares, 1 free guest with ticket |
| 5 | DB: payment record has `capture_method=manual`, `authorization_status=authorized`, customer + PM IDs | All fields populated |
| 6 | Payment link preview (public) | Shows amount, event, table — no sensitive data |
| 7 | Identity verification: wrong phone rejected, correct phone returns JWT | 403 / 200 as expected |
| 8 | Payment status endpoint | Full breakdown of shares + free guests |
| 9 | Add free guest | Guest added with ticket created, `num_people` incremented |

---

## Reliability Improvements

### Payment Scheduler Rework

The scheduler now runs two concurrent loops instead of a single daily pass:

**Frequent loop (every 30 min):**
- **Capture** — finds authorized payments where the event is tomorrow, captures on Stripe
- **Webhook reconciliation** — finds payment shares with a `stripe_checkout_session_id` that are still `pending` after 30 min, checks Stripe for the real session status, and auto-recovers (creates payment record, marks share paid, issues ticket, confirms reservation if all shares paid)

**Daily loop (09:00 UTC):**
- **Re-authorization** — refreshes Stripe holds older than 6 days (7-day limit)
- **Payment share expiry** — marks pending non-owner shares as `expired` after configurable TTL (default 48h)

### Alerting

All scheduler failures and recovery events are sent to a Discord/Slack webhook:
- Capture failures
- Re-authorization failures
- Reconciliation errors and recoveries
- Expired payment shares (includes guest phone, event name, table, owner name)

Configured via `ALERT_WEBHOOK_URL` env var. Sends both `content` (Discord) and `text` (Slack) fields.

### New Config

| Env Var | Default | Purpose |
|---------|---------|---------|
| `ALERT_WEBHOOK_URL` | (none) | Discord/Slack incoming webhook for failure alerts |
| `PAYMENT_SHARE_TTL_HOURS` | `48` | Hours before unpaid guest shares are marked expired |

### Files Modified

| File | Changes |
|------|---------|
| `rust_BE/src/services/payment_scheduler.rs` | Split into frequent (30 min) + daily (9am) loops; added reconciliation, expiry, alerting |
| `rust_BE/src/models/mod.rs` | Added `alert_webhook_url` and `payment_share_ttl_hours` to `AppState` |
| `rust_BE/src/main.rs` | Load new env vars, pass to `AppState` |

### Recovery Timeline

| Time | What happens |
|------|-------------|
| 0 min | Guest pays on Stripe Checkout |
| 0-5 min | Stripe webhook fires → normal path (instant) |
| 5 min - 3 days | Stripe retries webhook on failure (exponential backoff) |
| Next 30-min tick | Reconciliation job checks Stripe, auto-recovers if webhook failed |
| 48 hours | If guest never paid, share marked `expired`, owner alerted |

---

## TODO (Remaining)

- Build payment link **web page** for anonymous guests (preview → verify → Stripe Checkout redirect) — this is a separate web app, not React Native
- Configure `success_url` and `cancel_url` for Stripe Checkout sessions
- Populate `event_date` on existing events (currently NULL — scheduler needs this to know when to capture)
