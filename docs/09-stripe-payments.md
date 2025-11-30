# Stripe Payment Integration

## Overview

This document describes the Stripe payment integration for the Pierre Two nightclub reservation system, including both automatic and manual (authorization & capture) payment flows.

---

## Table of Contents

1. [Payment Flows](#payment-flows)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Integration](#frontend-integration)
6. [Webhook Handling](#webhook-handling)
7. [Testing](#testing)
8. [Error Handling](#error-handling)

---

## Payment Flows

### Flow 1: Automatic Capture (Immediate Payment)

**Use Case**: Ticket purchases, deposits, immediate payments

**Flow**:
1. Backend creates PaymentIntent with automatic capture
2. Frontend receives `client_secret`
3. Customer enters payment details via Stripe Elements
4. Customer confirms payment
5. **Stripe automatically captures funds**
6. Payment status → 'completed'

**API Call**:
```bash
POST /payments
{
  "sender_id": "customer-uuid",
  "receiver_id": "venue-uuid",
  "amount": 50.00
}
```

**Response**:
```json
{
  "id": "payment-uuid",
  "stripe_payment_intent_id": "pi_xxx",
  "status": "pending",
  "capture_method": "automatic",
  "authorization_status": "pending"
}
```

### Flow 2: Manual Capture (Authorization & Capture)

**Use Case**: Table reservations requiring authorization upfront, capture later

**Flow**:
1. Backend creates PaymentIntent with **manual** capture
2. Frontend receives `client_secret`
3. Customer enters payment details via Stripe Elements
4. Customer confirms payment
5. **Stripe authorizes (holds) funds for up to 7 days**
6. Payment authorization_status → 'authorized'
7. Backend captures payment when service is delivered
8. Payment status → 'completed'

**OR**

7. Backend cancels authorization if service is not delivered
8. Payment status → 'cancelled', funds released

**API Calls**:

**Create Authorization**:
```bash
POST /payments/authorize
{
  "sender_id": "customer-uuid",
  "receiver_id": "venue-uuid",
  "amount": 100.00
}
```

**Capture Payment**:
```bash
POST /payments/{payment_id}/capture
{
  "amount": 100.00  # Optional: omit for full capture
}
```

**Cancel Authorization**:
```bash
POST /payments/{payment_id}/cancel
```

---

## Database Schema

### Payments Table

**Columns**:
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- pending, authorized, completed, cancelled, failed
  insert_date TIMESTAMP NOT NULL,
  update_date TIMESTAMP,
  stripe_payment_intent_id VARCHAR(255),
  user_ids UUID[],

  -- Authorization & Capture fields
  capture_method VARCHAR(20) DEFAULT 'automatic',  -- automatic, manual
  authorization_status VARCHAR(20) DEFAULT 'pending',  -- pending, authorized, captured, cancelled, failed
  authorized_at TIMESTAMP,
  captured_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  authorized_amount DECIMAL(10, 2),
  captured_amount DECIMAL(10, 2),

  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);
```

**Indexes**:
```sql
CREATE INDEX idx_payments_authorization_status ON payments(authorization_status);
CREATE INDEX idx_payments_capture_method ON payments(capture_method);
CREATE INDEX idx_payments_authorized_at ON payments(authorized_at)
WHERE authorization_status = 'authorized';
```

**Status Values**:

| Field | Possible Values | Description |
|-------|----------------|-------------|
| `status` | pending | Payment intent created, awaiting customer payment |
| | authorized | Funds authorized (manual capture only) |
| | completed | Payment captured and transferred |
| | cancelled | Authorization cancelled, funds released |
| | failed | Payment failed |
| `capture_method` | automatic | Stripe captures immediately when customer pays |
| | manual | Authorization only, requires explicit capture |
| `authorization_status` | pending | Awaiting customer payment |
| | authorized | Funds held, awaiting capture |
| | captured | Funds captured and transferred |
| | cancelled | Authorization cancelled |
| | failed | Authorization failed |

---

## API Endpoints

### 1. Create Automatic Payment

**Endpoint**: `POST /payments`

**Description**: Create payment with automatic capture (immediate payment)

**Request Body**:
```json
{
  "sender_id": "uuid",
  "receiver_id": "uuid",
  "amount": 50.00,
  "user_ids": ["uuid1", "uuid2"]  // Optional
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "sender_id": "uuid",
  "receiver_id": "uuid",
  "amount": 50.00,
  "status": "pending",
  "stripe_payment_intent_id": "pi_xxx",
  "capture_method": "automatic",
  "authorization_status": "pending",
  "authorized_amount": 50.00,
  "insert_date": "2025-11-30T12:00:00",
  "update_date": "2025-11-30T12:00:00"
}
```

### 2. Create Authorized Payment

**Endpoint**: `POST /payments/authorize`

**Description**: Create payment with manual capture (authorization only)

**Request Body**:
```json
{
  "sender_id": "uuid",
  "receiver_id": "uuid",
  "amount": 100.00,
  "user_ids": ["uuid1", "uuid2"]  // Optional
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "sender_id": "uuid",
  "receiver_id": "uuid",
  "amount": 100.00,
  "status": "pending",
  "stripe_payment_intent_id": "pi_xxx",
  "capture_method": "manual",
  "authorization_status": "pending",
  "authorized_amount": 100.00,
  "insert_date": "2025-11-30T12:00:00"
}
```

### 3. Capture Authorized Payment

**Endpoint**: `POST /payments/:id/capture`

**Description**: Capture previously authorized payment

**Request Body** (Optional):
```json
{
  "amount": 90.00  // Optional: for partial capture. Omit for full capture.
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "status": "completed",
  "captured_amount": 100.00,
  "captured_at": "2025-11-30T14:00:00",
  "message": "Payment captured successfully"
}
```

**Validations**:
- Payment must have `capture_method: "manual"`
- Payment must be in 'authorized' state
- Partial capture amount must not exceed authorized amount

### 4. Cancel Authorization

**Endpoint**: `POST /payments/:id/cancel`

**Description**: Cancel authorization and release funds

**Request Body**: None

**Response** (200 OK):
```json
{
  "id": "uuid",
  "status": "cancelled",
  "cancelled_at": "2025-11-30T14:00:00",
  "message": "Payment authorization cancelled successfully"
}
```

**Validations**:
- Payment must have `capture_method: "manual"`
- Payment must be in 'authorized' state

### 5. Get Payment

**Endpoint**: `GET /payments/:id`

**Description**: Retrieve payment details

**Response** (200 OK):
```json
{
  "id": "uuid",
  "sender_id": "uuid",
  "receiver_id": "uuid",
  "amount": 100.00,
  "status": "authorized",
  "stripe_payment_intent_id": "pi_xxx",
  "capture_method": "manual",
  "authorization_status": "authorized",
  "authorized_at": "2025-11-30T12:30:00",
  "authorized_amount": 100.00,
  "insert_date": "2025-11-30T12:00:00",
  "update_date": "2025-11-30T12:30:00"
}
```

### 6. Get All Payments

**Endpoint**: `GET /payments`

**Description**: List payments with optional filters

**Query Parameters**:
- `sender_id` (integer, optional)
- `receiver_id` (integer, optional)
- `status` (string, optional): pending, authorized, completed, cancelled, failed
- `amount` (decimal, optional)

**Example**:
```bash
GET /payments?status=authorized
```

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "status": "authorized",
    ...
  },
  ...
]
```

### 7. Delete Payment

**Endpoint**: `DELETE /payments/:id`

**Description**: Delete payment record (use with caution)

**Response**:
- 204 No Content (success)
- 404 Not Found (payment doesn't exist)

---

## Backend Implementation

### Models

**File**: `rust_BE/src/models/payment.rs`

**Enums**:
```rust
#[derive(Debug, Serialize, Clone, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Authorized,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Serialize, Clone, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum PaymentCaptureMethod {
    Automatic,
    Manual,
}
```

**Entity**:
```rust
#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct PaymentEntity {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Uuid,
    pub amount: Decimal,
    pub status: PaymentStatus,
    pub insert_date: NaiveDateTime,
    pub update_date: Option<NaiveDateTime>,
    pub stripe_payment_intent_id: Option<String>,
    pub user_ids: Option<Vec<Uuid>>,

    // Authorization & Capture fields
    pub capture_method: Option<PaymentCaptureMethod>,
    pub authorization_status: Option<String>,
    pub authorized_at: Option<NaiveDateTime>,
    pub captured_at: Option<NaiveDateTime>,
    pub cancelled_at: Option<NaiveDateTime>,
    pub authorized_amount: Option<Decimal>,
    pub captured_amount: Option<Decimal>,
}
```

### Service Functions

**File**: `rust_BE/src/persistences/payment_persistence.rs`

**Key Functions**:
- `create_payment_service()` - Create payment with automatic capture
- `create_authorized_payment_service()` - Create payment with manual capture
- `capture_payment_service()` - Capture authorized payment
- `cancel_payment_authorization_service()` - Cancel authorization
- `load_payment_service()` - Get payment by ID
- `load_all_payments_service()` - List payments with filters

**Example Implementation**:
```rust
pub async fn create_authorized_payment_service(
    payload: PaymentRequest,
    app_state: &AppState
) -> Result<PaymentEntity, StatusCode> {
    // 1. Create Stripe PaymentIntent with manual capture
    let mut params = CreatePaymentIntent::new(amount_in_cents, Currency::EUR);
    params.capture_method = Some(stripe::PaymentIntentCaptureMethod::Manual);

    let payment_intent = PaymentIntent::create(&app_state.stripe_client, params).await?;

    // 2. Store in database
    let payment_entity = sqlx::query_as::<_, PaymentEntity>(
        "INSERT INTO payments (..., capture_method, authorization_status, authorized_amount)
         VALUES (..., $10, $11, $12)
         RETURNING ..."
    )
    .bind(PaymentCaptureMethod::Manual)
    .bind("pending")
    .bind(&payload.amount)
    .fetch_one(&app_state.db_pool)
    .await?;

    Ok(payment_entity)
}
```

### Controllers

**File**: `rust_BE/src/controllers/payment_controller.rs`

**Handlers**:
```rust
pub async fn post_payment(...) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode>
pub async fn post_authorized_payment(...) -> Result<(StatusCode, Json<PaymentEntity>), StatusCode>
pub async fn capture_payment(...) -> Result<Json<CapturePaymentResponse>, StatusCode>
pub async fn cancel_payment(...) -> Result<Json<CancelPaymentResponse>, StatusCode>
pub async fn get_payment(...) -> Result<Json<PaymentEntity>, StatusCode>
pub async fn get_all_payments(...) -> Result<Json<Vec<PaymentEntity>>, StatusCode>
pub async fn delete_payment(...) -> StatusCode
```

---

## Frontend Integration

### React Native with Stripe Elements

**Installation**:
```bash
npm install @stripe/stripe-react-native
```

**Setup**:
```typescript
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';

// In App root
<StripeProvider publishableKey="pk_test_...">
  <App />
</StripeProvider>
```

### Payment Flow Implementation

**1. Create Payment Intent (Automatic Capture)**:
```typescript
const createPayment = async (amount: number) => {
  const response = await fetch('http://localhost:3000/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: currentUser.id,
      receiver_id: venueId,
      amount: amount,
    }),
  });

  const payment = await response.json();
  return payment;
};
```

**2. Create Authorized Payment (Manual Capture)**:
```typescript
const createAuthorizedPayment = async (amount: number) => {
  const response = await fetch('http://localhost:3000/payments/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: currentUser.id,
      receiver_id: venueId,
      amount: amount,
    }),
  });

  const payment = await response.json();
  return payment;
};
```

**3. Collect Payment from Customer**:
```typescript
const { confirmPayment } = useStripe();

const handlePayment = async (clientSecret: string) => {
  const { error, paymentIntent } = await confirmPayment(clientSecret, {
    paymentMethodType: 'Card',
  });

  if (error) {
    console.error('Payment failed:', error);
    return;
  }

  console.log('Payment authorized:', paymentIntent);
};
```

**4. Capture Payment (Backend)**:
```typescript
const capturePayment = async (paymentId: string, amount?: number) => {
  const response = await fetch(`http://localhost:3000/payments/${paymentId}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount,  // Optional: for partial capture
    }),
  });

  const result = await response.json();
  return result;
};
```

**5. Cancel Authorization (Backend)**:
```typescript
const cancelPayment = async (paymentId: string) => {
  const response = await fetch(`http://localhost:3000/payments/${paymentId}/cancel`, {
    method: 'POST',
  });

  const result = await response.json();
  return result;
};
```

### Complete Table Reservation Flow

```typescript
// 1. User selects table and enters details
const reserveTable = async (tableId: string, guests: number) => {
  // 2. Create authorized payment
  const payment = await createAuthorizedPayment(100.00);

  // 3. Collect payment from customer
  await handlePayment(payment.client_secret);

  // 4. Create reservation (after customer completes payment)
  const reservation = await fetch('http://localhost:3000/reservations/user/' + userId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: tableId,
      number_of_guests: guests,
      payment_id: payment.id,  // Link payment to reservation
    }),
  });

  return reservation;
};

// 5. When customer shows up (backend trigger)
const confirmReservation = async (reservationId: string, paymentId: string) => {
  await capturePayment(paymentId);
  // Update reservation status
};

// 6. If customer cancels (backend trigger)
const cancelReservation = async (reservationId: string, paymentId: string) => {
  await cancelPayment(paymentId);
  // Update reservation status
};
```

---

## Webhook Handling

### Stripe Webhook Events

**Important Events**:
- `payment_intent.succeeded` - Customer completed payment (funds authorized)
- `payment_intent.payment_failed` - Payment failed
- `payment_intent.canceled` - Payment cancelled
- `payment_intent.amount_capturable_updated` - Authorization amount changed

### Implementation (Future)

**File**: `rust_BE/src/webhooks/stripe_webhook.rs`

```rust
use axum::{extract::State, http::HeaderMap, body::Bytes};
use stripe::{Webhook, EventType, EventObject};

pub async fn handle_stripe_webhook(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, StatusCode> {
    // Get webhook secret from environment
    let webhook_secret = env::var("STRIPE_WEBHOOK_SECRET")
        .expect("STRIPE_WEBHOOK_SECRET must be set");

    // Verify webhook signature
    let signature = headers
        .get("stripe-signature")
        .ok_or(StatusCode::BAD_REQUEST)?
        .to_str()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let body_str = std::str::from_utf8(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Construct and verify event
    let event = Webhook::construct_event(body_str, signature, &webhook_secret)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Handle event
    match event.type_ {
        EventType::PaymentIntentSucceeded => {
            if let EventObject::PaymentIntent(payment_intent) = event.data.object {
                // Update payment authorization_status to 'authorized'
                update_payment_authorization_status(
                    &payment_intent.id.to_string(),
                    "authorized",
                    &app_state
                ).await?;
            }
        },
        EventType::PaymentIntentPaymentFailed => {
            if let EventObject::PaymentIntent(payment_intent) = event.data.object {
                // Update payment status to 'failed'
                update_payment_status(
                    &payment_intent.id.to_string(),
                    PaymentStatus::Failed,
                    &app_state
                ).await?;
            }
        },
        _ => {}
    }

    Ok(StatusCode::OK)
}
```

**Register Webhook Route**:
```rust
// In main.rs
.route("/webhooks/stripe", post(handle_stripe_webhook))
```

**Stripe Dashboard Setup**:
1. Go to Developers → Webhooks
2. Add endpoint: `https://your-domain.com/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, etc.
4. Copy webhook signing secret to environment variable

---

## Testing

### Test with Stripe Test Mode

**Test Card Numbers**:
- Success: `4242 4242 4242 4242`
- Requires authentication: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

**Test Flow**:

**1. Create Authorized Payment**:
```bash
curl -X POST http://localhost:3000/payments/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "550e8400-e29b-41d4-a716-446655440000",
    "receiver_id": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 100.00
  }'
```

**2. Use Stripe Dashboard** to simulate customer payment:
- Go to Stripe Dashboard → Payments
- Find the PaymentIntent
- Click "Capture" or use test card in Elements

**3. Capture Payment**:
```bash
curl -X POST http://localhost:3000/payments/{payment_id}/capture \
  -H "Content-Type: application/json" \
  -d '{}'
```

**4. Verify in Database**:
```sql
SELECT id, status, authorization_status, captured_at
FROM payments
WHERE id = '{payment_id}';
```

### Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|----------------|
| Successful automatic payment | POST /payments → confirm with card | status: completed |
| Successful authorization | POST /payments/authorize → confirm with card | authorization_status: authorized |
| Full capture | POST /payments/{id}/capture (no amount) | captured_amount = authorized_amount |
| Partial capture | POST /payments/{id}/capture (amount: 50) | captured_amount = 50 |
| Cancel authorization | POST /payments/{id}/cancel | status: cancelled, funds released |
| Capture wrong status | Try to capture 'pending' payment | 400 Bad Request |
| Cancel wrong status | Try to cancel 'completed' payment | 400 Bad Request |

---

## Error Handling

### Common Errors

| Error | Status Code | Cause | Solution |
|-------|------------|-------|----------|
| Payment not found | 404 | Invalid payment ID | Check payment ID |
| Cannot capture | 400 | Payment not in 'authorized' state | Verify authorization_status |
| Cannot cancel | 400 | Payment not in 'authorized' state | Verify authorization_status |
| Stripe API error | 502 | Stripe service error | Retry request, check Stripe status |
| Invalid amount | 400 | Amount exceeds authorized amount | Reduce capture amount |
| Missing credentials | 500 | Stripe keys not configured | Set environment variables |

### Error Response Format

```json
{
  "error": "Payment not found",
  "status": 404
}
```

### Backend Error Logging

```rust
.map_err(|e| {
    eprintln!("Stripe capture error: {:?}", e);
    StatusCode::BAD_GATEWAY
})?
```

---

## Security Best Practices

### Environment Variables

**Required**:
```bash
# Backend uses secret key
STRIPE_SECRET_KEY=sk_test_...

# Frontend uses publishable key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook verification (if using webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...
```

**NEVER** commit these values to version control!

### Webhook Security

- Always verify webhook signatures
- Use HTTPS for webhook endpoints in production
- Implement idempotency for webhook handlers
- Log all webhook events for debugging

### Amount Validation

- Always validate amounts server-side
- Never trust client-provided amounts for capture
- Check authorized amount before partial capture
- Use Decimal type to avoid floating-point errors

### Authorization Expiration

- Stripe authorizations expire after 7 days
- Implement cleanup job for expired authorizations
- Notify users before expiration
- Auto-cancel if not captured in time

---

## Summary

### Payment Types

| Type | Use Case | Endpoint | Capture |
|------|----------|----------|---------|
| Automatic | Tickets, deposits | POST /payments | Immediate |
| Manual (Auth) | Table reservations | POST /payments/authorize | Later |

### Key Features

- ✅ Automatic and manual capture modes
- ✅ Full and partial capture support
- ✅ Authorization cancellation
- ✅ 7-day authorization window
- ✅ Comprehensive error handling
- ✅ Database transaction tracking
- ✅ Stripe webhook support (future)

### Next Steps

1. Implement Stripe webhooks for automatic status updates
2. Add frontend payment UI with Stripe Elements
3. Create cron job for authorization expiration cleanup
4. Add admin dashboard for payment management
5. Implement refund functionality
6. Add payment analytics and reporting
