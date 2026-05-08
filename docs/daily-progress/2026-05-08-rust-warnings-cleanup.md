# 2026-05-08: Rust backend dead-code cleanup

**Branch**: `claude/fix-rust-warnings-3DUM6`
**Status**: Ready for review

---

## Overview

`cargo check` on `rust_BE/` was emitting 28 warnings, all variants of
`dead_code` / `unused_imports`. The warnings hid genuine signal (an old
`AppError` envelope competing with the documented `ApiError` flow, two
`generate_payment_link_token` definitions, a duplicate `delete_table_image`,
and a large block of split-payment repository code that had been superseded
by the inline transactional flow in `reservation_service.rs`).

This pass removes the dead code and silences the unavoidable
SQLx-FromRow field warnings with `#[allow(dead_code)]`. After the cleanup
`cargo check` reports 0 warnings on our own crate (the only remaining notice
is a future-incompat warning from `sqlx-postgres v0.7.4`, an upstream
dependency).

---

## Changes

### Backend

- **`src/api/errors.rs`** — collapsed the `AppError` envelope into `ApiError`
  directly. The whole `AppError` struct, its `validation` / `unauthorized` /
  `forbidden` / `not_found` / `conflict` / `external_dependency` / `internal`
  constructors, the `AppResult` type alias, and the
  `From<StatusCode>` / `From<sqlx::Error>` / `IntoResponse` impls were never
  called outside of `ApiError::new`'s internal delegation. `ApiError::new`
  now computes the code and returns the `(StatusCode, Json<ApiError>)` tuple
  directly, matching the pattern used everywhere in the controllers (see
  `CLAUDE.md` "Error responses" section).
- **`src/models/mod.rs`** — removed the `AppError` / `AppResult` re-export
  and the unused `PaymentShareResponse` / `ReservationGuest` re-exports.
- **`src/infrastructure/repositories/club_owner_persistence.rs`** — deleted
  `delete_table_image`. The controller (`delete_table_image_handler`) calls
  `delete_table_image_for_club`, which authorises by club. The unscoped
  variant was an unused historical leftover.
- **`src/infrastructure/repositories/table_persistence.rs`** — deleted nine
  split-payment / free-guest functions that nothing called any more:
  `add_guest_to_reservation`, `generate_payment_link_token` (a duplicate of
  the one inlined in `table_controller.rs` at line 1114),
  `create_payment_share`, `get_payment_share_by_token`,
  `update_payment_share_paid`, `add_free_guest`,
  `get_free_guests_by_reservation`, `get_total_people_count`,
  `increment_reservation_amount_paid`, `update_reservation_num_people`. The
  active split-payment helpers (`get_reservation_by_payment_link_token`,
  `get_payment_share_by_checkout_session`, `get_payment_shares_by_reservation`,
  `set_payment_share_checkout_session`, `check_and_confirm_reservation`)
  are kept untouched. The stale `ReservationGuest` import was dropped from
  the file header.
- **`src/infrastructure/repositories/payment_persistence.rs`** — removed
  `load_payment_by_stripe_id` (never called; webhook uses a different
  lookup).
- **`src/infrastructure/repositories/ticket_persistence.rs`** — removed
  `get_tickets_by_user_id` (mobile uses a different aggregated query).
- **`src/infrastructure/logging/mod.rs`** — removed the trio
  `log_business_event` / `log_dependency_event` / `log_security_event`. They
  were a planned observability surface that nothing emits to today; can be
  re-introduced when an actual call site lands.
- **`src/services/storage_service.rs`** — removed the unused
  `StorageService::is_configured` helper.
- **`src/models/table.rs`** — removed dead request/row structs:
  `CreateReservationWithPaymentRequest`, `TableReservationPayment`,
  `TableReservationTicket`, `CreatePaymentIntentRequest`,
  `ReservationGuest`. The replacement flow uses
  `CreateSplitReservationRequest` / `CreateSplitPaymentIntentRequest` and
  the per-share `ReservationPaymentShare` row.
- **`src/models/payment.rs`** — removed `PaymentResponse` (controllers
  return `CapturePaymentResponse` / `CancelPaymentResponse` instead).
- **`src/infrastructure/outbox/mod.rs`** — annotated `OutboxEvent` with
  `#[allow(dead_code)]`. Six fields (`aggregate_type`, `status`,
  `available_at`, `last_error`, `created_at`, `processed_at`) are populated
  by SQLx via `#[derive(FromRow)]` for diagnostics but the dispatcher only
  reads `id`, `event_type`, `aggregate_id`, `payload`, `attempts`. The
  fields are intentionally hydrated for log/debug visibility.
- **`src/bootstrap/config.rs`** — annotated
  `FeatureFlagsConfig.bootstrap_flags_from_env` with
  `#[allow(dead_code)]`. The env var is parsed at startup so the build
  carries the configured value for the future provider implementation, but
  no consumer reads it yet.

### Dashboard / Mobile / Database

No code changes.

---

## Files Modified

| File | Change |
|---|---|
| `rust_BE/src/api/errors.rs` | Collapsed `AppError` into `ApiError`; deleted unused constructors / impls |
| `rust_BE/src/models/mod.rs` | Removed dead re-exports (`AppError`, `AppResult`, `PaymentShareResponse`, `ReservationGuest`) |
| `rust_BE/src/models/table.rs` | Removed 5 unused request/row structs |
| `rust_BE/src/models/payment.rs` | Removed unused `PaymentResponse` |
| `rust_BE/src/infrastructure/repositories/club_owner_persistence.rs` | Removed unscoped `delete_table_image` duplicate |
| `rust_BE/src/infrastructure/repositories/table_persistence.rs` | Removed 9 dead split-payment helpers + stale import |
| `rust_BE/src/infrastructure/repositories/payment_persistence.rs` | Removed `load_payment_by_stripe_id` |
| `rust_BE/src/infrastructure/repositories/ticket_persistence.rs` | Removed `get_tickets_by_user_id` |
| `rust_BE/src/infrastructure/logging/mod.rs` | Removed 3 unused event helpers |
| `rust_BE/src/infrastructure/outbox/mod.rs` | `#[allow(dead_code)]` on `OutboxEvent` (SQLx-mapped DB columns) |
| `rust_BE/src/services/storage_service.rs` | Removed unused `StorageService::is_configured` |
| `rust_BE/src/bootstrap/config.rs` | `#[allow(dead_code)]` on `FeatureFlagsConfig.bootstrap_flags_from_env` |
| `docs/daily-progress/2026-05-08-rust-warnings-cleanup.md` | New (this file) |

---

## Verification

```bash
cd rust_BE
cargo fmt
cargo check     # 0 warnings on our crate (only sqlx-postgres future-incompat from upstream)
```

Before: 28 warnings. After: 0.
