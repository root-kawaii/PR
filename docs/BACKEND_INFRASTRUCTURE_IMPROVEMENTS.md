# Backend Infrastructure Improvements

## Purpose

This document outlines practical infrastructure and architectural improvements for the Rust backend in [`rust_BE/`](/Users/root-kawaii/Desktop/PR/rust_BE), with a focus on:

- readability
- separation of concerns
- scalability
- observability
- backend-safe feature flagging
- a possible PostHog integration strategy

It is intentionally opinionated and grounded in the current codebase rather than being a generic microservices checklist.

## Current Backend Snapshot

Current backend stack and structure:

- Axum 0.7 + Tokio in [`rust_BE/src/main.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/main.rs)
- SQLx + PostgreSQL in [`rust_BE/Cargo.toml`](/Users/root-kawaii/Desktop/PR/rust_BE/Cargo.toml)
- route handlers in [`rust_BE/src/controllers/`](/Users/root-kawaii/Desktop/PR/rust_BE/src/controllers)
- query logic in [`rust_BE/src/persistences/`](/Users/root-kawaii/Desktop/PR/rust_BE/src/persistences)
- side-effect helpers in [`rust_BE/src/services/`](/Users/root-kawaii/Desktop/PR/rust_BE/src/services)
- request ID and auth middleware in [`rust_BE/src/middleware/`](/Users/root-kawaii/Desktop/PR/rust_BE/src/middleware)
- tracing-based logging in [`rust_BE/src/logging/mod.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/logging/mod.rs)
- idempotency utilities in [`rust_BE/src/idempotency/`](/Users/root-kawaii/Desktop/PR/rust_BE/src/idempotency)

### Main strengths today

- Clear basic split between HTTP handlers and persistence helpers.
- Good platform choices for long-term maintainability.
- Existing request ID middleware and tracing already provide a strong base for better observability.
- Existing idempotency module is a useful foundation for payment-critical endpoints.

### Main structural pressure points today

- [`rust_BE/src/main.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/main.rs) owns too much routing and infrastructure wiring.
- Controllers appear to orchestrate domain logic, persistence, payment logic, and response shaping in the same layer.
- `AppState` in [`rust_BE/src/models/mod.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/models/mod.rs) is accumulating cross-cutting dependencies directly.
- Persistence modules contain a mix of simple CRUD and domain-specific workflow helpers.
- Logging exists, but there is not yet a strong distinction between logs, audit events, metrics, and business events.
- There is no explicit backend feature-flag abstraction yet.

## Recommended Architectural Direction

The backend does not need to become microservices. A cleaner modular monolith is the right next step.

Recommended target shape:

```text
rust_BE/src/
  api/
    routers/
    extractors/
    responses/
    errors/
  application/
    auth/
    events/
    reservations/
    tickets/
    payments/
    owners/
  domain/
    auth/
    events/
    reservations/
    tickets/
    payments/
    shared/
  infrastructure/
    db/
    stripe/
    notifications/
    feature_flags/
    analytics/
    logging/
  middleware/
  bootstrap/
```

This is still one deployable service, but each layer has a clearer responsibility.

## Priority Improvements

## 1. Split HTTP from Application Logic

Current issue:

- Controllers such as [`rust_BE/src/controllers/table_controller.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/controllers/table_controller.rs) appear to do input parsing, orchestration, multi-step DB fetching, payment work, and response assembly in one place.

Recommended change:

- Keep controllers thin.
- Move business workflows into application services such as:
  - `reservation_service`
  - `payment_service`
  - `ticket_service`
  - `owner_service`

Controller responsibilities should become:

- extract request
- call service
- map service result into HTTP response

Application service responsibilities should become:

- validate domain rules
- coordinate repositories
- call Stripe, SMS, push, or analytics adapters
- emit business/audit events

Benefits:

- easier testing
- easier onboarding
- clearer ownership boundaries
- safer future refactors

## 2. Replace `persistences/` with Repository-Style Infrastructure Modules

Current issue:

- `persistences` currently mixes low-level data access with some workflow-heavy logic.

Recommended change:

- Rename and reshape `persistences/` into repositories under `infrastructure/db/` or `repositories/`.
- Give each repository a narrow contract.

Examples:

- `EventRepository`
- `ReservationRepository`
- `PaymentRepository`
- `OwnerRepository`

Repository rules:

- database access only
- no HTTP shaping
- no external API calls
- no business orchestration

Benefits:

- cleaner mental model
- easier mocking in tests
- easier future move to caching or read replicas

## 3. Move `AppState` to a Dedicated Bootstrap Layer

Current issue:

- `AppState` lives in [`rust_BE/src/models/mod.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/models/mod.rs), which makes application wiring feel mixed into domain/model definitions.

Recommended change:

- move `AppState` into `bootstrap/app_state.rs` or `infrastructure/app_state.rs`
- introduce dedicated typed clients:
  - `StripeGateway`
  - `NotificationGateway`
  - `FeatureFlagProvider`
  - `AnalyticsPublisher`

Example shape:

```rust
pub struct AppState {
    pub db: PgPool,
    pub stripe: Arc<dyn StripeGateway>,
    pub notifications: Arc<dyn NotificationGateway>,
    pub feature_flags: Arc<dyn FeatureFlagProvider>,
    pub analytics: Arc<dyn AnalyticsPublisher>,
    pub config: Arc<AppConfig>,
}
```

Benefits:

- state becomes infrastructure-focused
- model layer stays focused on domain/request/response types
- easier dependency replacement in tests and staging

## 4. Introduce a Central Error Model

Current issue:

- many handlers still return raw `StatusCode` or generic internal-server-error responses.
- the project already has `ApiError`, but it is not the obvious backbone for all failure handling.

Recommended change:

- create a central `AppError` enum
- implement:
  - domain errors
  - infra errors
  - mapping into HTTP error payloads
- ensure all controllers return `Result<T, AppError>`

Example categories:

- `Validation`
- `Unauthorized`
- `Forbidden`
- `NotFound`
- `Conflict`
- `ExternalDependency`
- `RateLimited`
- `Internal`

Benefits:

- consistent frontend behavior
- better logs
- easier metrics by error class
- easier alerting

## 5. Break the Router into Domain Routers

Current issue:

- [`rust_BE/src/main.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/main.rs) is very large and owns most route registration.

Recommended change:

- create router modules:
  - `api/routers/auth.rs`
  - `api/routers/events.rs`
  - `api/routers/reservations.rs`
  - `api/routers/payments.rs`
  - `api/routers/owner.rs`

Then `main.rs` becomes mostly:

- config loading
- logger init
- DB/client init
- middleware setup
- `build_router(app_state)`

Benefits:

- better readability
- easier review diffs
- fewer merge conflicts

## 6. Separate Read Models from Write Models

Current issue:

- reservation and event endpoints appear to assemble several related records inside controller code.

Recommended change:

- introduce explicit query/read services for rich frontend payloads
- keep mutation flows separate from read composition

Examples:

- `ReservationQueryService::get_user_reservations_with_details`
- `OwnerDashboardQueryService::get_event_reservations`

Benefits:

- easier optimization for list endpoints
- easier caching/read-replica adoption later
- avoids contaminating write-side logic with presentation needs

## Observability Improvements

## 7. Strengthen Structured Logging

Current status:

- logging already writes pretty console logs and JSON file logs in [`rust_BE/src/logging/mod.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/logging/mod.rs)

Recommended next step:

- standardize log fields across all request handlers and background jobs

Core fields to include in nearly all logs:

- `request_id`
- `user_id`
- `club_id`
- `event_id`
- `reservation_id`
- `ticket_id`
- `payment_id`
- `route`
- `status_code`
- `latency_ms`
- `feature_flag_key`
- `feature_flag_variant`
- `dependency`

Also add log categories:

- request logs
- business event logs
- dependency logs
- security logs
- audit logs

Recommended tracing spans:

- request span per HTTP request
- workflow span per reservation/payment flow
- dependency span per Stripe/Twilio/PostHog call

Benefits:

- much easier debugging
- better correlation across services
- better support for future log shipping

## 8. Add Metrics, Not Just Logs

Logging is necessary but not sufficient.

Recommended metrics:

- request count by route and status
- latency by route
- Stripe dependency latency and error rate
- SMS send attempts and failures
- push notification success/failure
- reservation creation count
- payment authorization, capture, cancel counts
- feature flag evaluation count by flag/variant

Possible stack:

- Prometheus-compatible endpoint
- OpenTelemetry metrics
- or lightweight custom counters if you want a smaller first step

Benefits:

- faster operational diagnosis
- real scalability signals instead of anecdotal debugging

## 9. Add Audit Logging for Sensitive Operations

Recommended for:

- owner check-in actions
- reservation status changes
- manual reservation creation
- payment capture and cancellation
- login and verification flows

Audit logs should be:

- append-only in intent
- more structured than normal app logs
- queryable by actor, target entity, and timestamp

Potential destination:

- dedicated DB table
- or external sink if you later centralize observability

## Scalability and Reliability Improvements

## 10. Formalize Background Jobs

Current status:

- background-style logic exists, such as payment scheduling in [`rust_BE/src/services/payment_scheduler.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/services/payment_scheduler.rs)

Recommended change:

- define an explicit jobs subsystem
- separate synchronous request work from asynchronous follow-up work

Candidates for jobs:

- payment-share expiration
- payment reminder notifications
- cleanup/reconciliation tasks
- webhook retry/reconciliation
- analytics batching

Benefits:

- faster API responses
- fewer timeout-prone request paths
- safer retries

## 11. Add Outbox/Event Publishing Pattern for External Side Effects

Current issue:

- direct external calls inside request flows can create partial-failure risk.

Recommended change:

- for important external effects, write an outbox event inside the DB transaction
- publish asynchronously from an outbox worker

Good candidates:

- analytics events
- notification sends
- webhook fan-out

Benefits:

- safer retries
- better delivery guarantees
- easier debugging of missed notifications/events

## 12. Prepare for Read Replicas and Caching Later

Not necessarily needed immediately, but code should not block it.

Prepare by:

- separating read/query services from write services
- avoiding business logic in repositories
- identifying high-read endpoints:
  - events list
  - club/public details
  - tables by event
  - owner dashboard aggregates

Potential future additions:

- Redis for hot read caches and rate limits
- read replica for public event browsing traffic

## 13. Improve Configuration Management

Recommended change:

- move environment access behind a typed `AppConfig`
- validate all required config at startup
- group config by area:
  - database
  - auth
  - stripe
  - notifications
  - analytics
  - feature flags

Benefits:

- fewer runtime surprises
- cleaner bootstrap
- easier staging/production parity

## PostHog Integration Proposal

## Goal

Use PostHog on the backend for:

- business analytics
- operational event capture
- backend-side feature flag evaluation or exposure tracking
- gradual rollout support for risky backend features

Important principle:

- feature-flag decisions that affect backend behavior should not depend only on the client
- the backend should be able to evaluate or at least validate the effective flag state

## Recommended Integration Model

Create two abstractions:

- `AnalyticsPublisher`
- `FeatureFlagProvider`

Possible module structure:

```text
rust_BE/src/infrastructure/analytics/
  mod.rs
  posthog.rs

rust_BE/src/infrastructure/feature_flags/
  mod.rs
  posthog.rs
  config.rs
  models.rs
```

### `AnalyticsPublisher`

Responsibilities:

- capture backend business events
- attach stable identifiers and metadata
- optionally buffer or batch events

Examples of events worth sending:

- `reservation_created`
- `reservation_payment_share_created`
- `reservation_payment_completed`
- `ticket_checked_in`
- `owner_manual_reservation_created`
- `sms_verification_sent`
- `sms_verification_verified`
- `stripe_webhook_received`
- `stripe_webhook_failed`

Recommended event payload fields:

- `distinct_id`
- `request_id`
- `user_id`
- `club_id`
- `event_id`
- `reservation_id`
- `ticket_id`
- `payment_id`
- `source`
- `environment`
- `app_version`

### `FeatureFlagProvider`

Responsibilities:

- evaluate flags for a user, owner, club, or request context
- return typed variants
- log exposure and evaluation results
- support safe fallback when PostHog is unavailable

Recommended interface shape:

```rust
pub trait FeatureFlagProvider: Send + Sync {
    async fn is_enabled(&self, key: &str, ctx: &FlagContext) -> bool;
    async fn get_variant(&self, key: &str, ctx: &FlagContext) -> FlagVariant;
}
```

Example `FlagContext` fields:

- `user_id`
- `club_id`
- `owner_id`
- `email`
- `app_platform`
- `app_version`
- `country`
- `request_id`

## Feature Flag Use Cases for This Backend

Good early backend flags:

- `split_payments_v2`
- `owner_manual_reservations_enabled`
- `stripe_delayed_capture_enabled`
- `reservation_code_lookup_v2`
- `send_payment_reminder_notifications`
- `posthog_backend_capture_enabled`

Good rollout strategy:

1. environment toggle
2. internal users only
3. selected clubs
4. percentage rollout
5. full rollout

## Logging Requirements for Feature Flags

Every backend feature flag evaluation should emit structured logs.

Recommended fields:

- `feature_flag_key`
- `feature_flag_result`
- `feature_flag_variant`
- `evaluation_source`
- `user_id`
- `club_id`
- `request_id`

Example:

```text
feature_flag_evaluated
flag=split_payments_v2
variant=enabled
user_id=...
club_id=...
request_id=...
source=posthog
```

This matters because feature flags without observability become very hard to debug in production.

## Recommended PostHog Delivery Model

Short term:

- use backend-side HTTP client calls to PostHog capture endpoint
- synchronous fire-and-forget only for low-risk events
- otherwise enqueue events or write to outbox

Medium term:

- outbox-backed analytics publishing
- retries with exponential backoff
- dead-letter visibility for repeated failures

Recommended rule:

- analytics failure must never break the main user flow
- feature-flag fetch failure must fall back deterministically

## Safe Feature Flag Fallback Policy

Define fallback classes clearly:

- fail-open flags
  - cosmetic or non-critical enhancements
- fail-closed flags
  - payment behavior
  - authorization changes
  - risky reservation workflow changes

Examples:

- `send_payment_reminder_notifications`: fail closed or disabled by default
- `split_payments_v2`: fail closed
- `posthog_backend_capture_enabled`: fail closed
- `new_owner_dashboard_stats`: fail open if it only changes aggregation shape

## Suggested Rollout Plan

## Phase 1: Structure

- split `main.rs` router registration into domain routers
- introduce `AppConfig`
- move `AppState` out of models
- standardize `AppError`

## Phase 2: Application Layer

- create service layer for reservations, payments, owners, auth
- make controllers thin
- keep repositories focused on DB only

## Phase 3: Observability

- standardize structured logging fields
- add metrics
- add audit log stream/table
- add dependency spans around Stripe/Twilio/PostHog

## Phase 4: PostHog + Flags

- add `AnalyticsPublisher`
- add `FeatureFlagProvider`
- implement safe fallback behavior
- emit analytics and flag evaluation logs

## Phase 5: Reliability

- introduce outbox pattern
- move non-critical side effects to async jobs
- add reconciliation jobs for payment and notification workflows

## Recommended First 5 Concrete Tasks

1. Create `bootstrap/app_state.rs` and `bootstrap/config.rs`.
2. Move route registration from [`rust_BE/src/main.rs`](/Users/root-kawaii/Desktop/PR/rust_BE/src/main.rs) into domain router modules.
3. Introduce `AppError` and migrate controllers to return it.
4. Add a `reservation_service` and move multi-step reservation orchestration there.
5. Add `feature_flags` and `analytics` modules with no-op implementations first, then PostHog-backed implementations second.

## Final Recommendation

The backend should evolve as a modular monolith with stronger boundaries, not as a rushed microservices split.

The highest-value improvements are:

- thinner controllers
- explicit application services
- repository cleanup
- typed config and app state
- stronger structured logging
- backend-owned feature flag evaluation
- PostHog integration through abstractions, not direct ad hoc calls everywhere

That path gives better readability now and much better scalability later, without paying unnecessary architectural complexity too early.
