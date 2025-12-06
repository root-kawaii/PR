# Idempotency Implementation Guide

## Overview

The payment system now includes idempotency support to prevent duplicate Stripe charges when users retry requests due to network issues, button double-clicks, or mobile app retries.

## How It Works

1. **Client generates idempotency key**: A UUID that uniquely identifies each payment request
2. **Server checks for duplicates**: Uses database UNIQUE constraint as distributed lock
3. **Request fingerprint validation**: SHA256 hash ensures same key isn't reused with different payloads
4. **Result caching**: Successful payments are cached and returned for duplicate requests
5. **Concurrent request handling**: If multiple requests arrive simultaneously, only one executes
6. **Automatic cleanup**: Expired idempotency records (24h) are cleaned up hourly

## Database Schema

### New Table: `idempotency_keys`

```sql
CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY,
    idempotency_key UUID NOT NULL UNIQUE,  -- Client-provided key
    request_hash VARCHAR(64) NOT NULL,      -- SHA256 of request payload
    status VARCHAR(20) NOT NULL,            -- pending, in_progress, completed, failed
    payment_id UUID,                        -- Links to payments.id
    error_message TEXT,                     -- Error details if failed
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL           -- TTL (24 hours default)
);
```

## API Usage

### Example: Creating a Payment with Idempotency

**Request:**
```json
POST /payments
{
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "receiver_id": "660e8400-e29b-41d4-a716-446655440001",
  "amount": 150.00,
  "idempotency_key": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Behavior:**

| Scenario | Response | Stripe Charge Created? |
|----------|----------|----------------------|
| **First request** | 200 + payment created | ✅ Yes |
| **Duplicate (completed)** | 200 + existing payment | ❌ No - returns cached |
| **Duplicate (in-progress)** | 200 + waits for completion | ❌ No - waits for first |
| **Duplicate (failed)** | 200 + retries operation | ✅ Yes - retry allowed |
| **Same key, different payload** | 422 Unprocessable Entity | ❌ No - rejected |

### Example: Creating Table Reservation with Idempotency

**Request:**
```json
POST /reservations/create-payment-intent
{
  "table_id": "uuid",
  "event_id": "uuid",
  "owner_user_id": "uuid",
  "guest_phone_numbers": ["+1234567890"],
  "idempotency_key": "880e8400-e29b-41d4-a716-446655440003"
}
```

## Frontend Integration

### React Native / TypeScript

```typescript
import { v4 as uuidv4 } from 'uuid';

async function createPayment(payload: PaymentRequest) {
  // Generate idempotency key ONCE
  const idempotencyKey = uuidv4();

  try {
    const response = await fetch('/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        idempotency_key: idempotencyKey,
      }),
    });

    return await response.json();
  } catch (error) {
    // On network error, retry with SAME idempotency key
    console.log('Retrying with same idempotency key:', idempotencyKey);
    const retryResponse = await fetch('/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        idempotency_key: idempotencyKey, // Same key!
      }),
    });

    return await retryResponse.json();
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function createPaymentWithRetry(
  payload: PaymentRequest,
  maxRetries = 3
) {
  const idempotencyKey = uuidv4(); // Generate once

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          idempotency_key: idempotencyKey,
        }),
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 422) {
        // Idempotency key reused with different payload - don't retry
        throw new Error('Invalid idempotency key');
      }

      // Other error - wait and retry
      if (attempt < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, attempt)); // Exponential backoff
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Supported Endpoints

All payment-related endpoints now support optional `idempotency_key` parameter:

1. **POST /payments** - Create automatic payment
2. **POST /payments/authorize** - Create authorized payment (manual capture)
3. **POST /reservations/create-payment-intent** - Create Stripe PaymentIntent
4. **POST /reservations/create-with-payment** - Create reservation with payment

## Configuration

Idempotency settings can be configured in [rust_BE/src/idempotency/models.rs](rust_BE/src/idempotency/models.rs):

```rust
pub struct IdempotencyConfig {
    pub ttl_seconds: i64,      // Default: 86400 (24 hours)
    pub max_retries: u32,      // Default: 10 (for waiting on in-progress)
    pub retry_delay_ms: u64,   // Default: 100ms
}
```

## Cleanup Job

A background job runs every hour to delete expired idempotency records:

```rust
// In main.rs
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(3600));
    loop {
        interval.tick().await;
        sqlx::query("SELECT cleanup_expired_idempotency_keys()")
            .execute(&pool)
            .await;
    }
});
```

## Error Handling

### 422 Unprocessable Entity

**Cause**: Idempotency key reused with different request payload

**Example**:
```json
// First request
POST /payments { "amount": 100, "idempotency_key": "key-123" }

// Second request with SAME key but DIFFERENT payload
POST /payments { "amount": 200, "idempotency_key": "key-123" }
// ❌ Returns 422 - key reused with different amount
```

**Solution**: Generate a new idempotency key for each unique request

### 408 Request Timeout

**Cause**: Waited too long for in-progress operation to complete

**Solution**:
- Check if the operation eventually succeeded in the database
- Retry with a new idempotency key if needed
- Increase `max_retries` or `retry_delay_ms` in config if needed

## Best Practices

### ✅ DO

1. **Generate idempotency keys client-side** using UUID v4
2. **Reuse the same key on retry** for network failures
3. **Store the key with pending requests** to retry on app restart
4. **Include idempotency key in all payment requests** for safety

### ❌ DON'T

1. **Don't reuse keys across different operations** (e.g., different amounts)
2. **Don't generate new keys on retry** - defeats the purpose
3. **Don't skip idempotency keys** for "small" payments - all charges should be protected
4. **Don't expect idempotency to work forever** - keys expire after 24 hours

## Testing

### Manual Testing

1. **Test duplicate prevention**:
   ```bash
   # Send same request twice with same idempotency key
   curl -X POST http://localhost:3000/payments \
     -H "Content-Type: application/json" \
     -d '{
       "sender_id": "uuid1",
       "receiver_id": "uuid2",
       "amount": 100,
       "idempotency_key": "test-key-123"
     }'

   # Repeat same request - should return existing payment
   curl -X POST http://localhost:3000/payments \
     -H "Content-Type: application/json" \
     -d '{
       "sender_id": "uuid1",
       "receiver_id": "uuid2",
       "amount": 100,
       "idempotency_key": "test-key-123"
     }'
   ```

2. **Test fingerprint validation**:
   ```bash
   # Send request with same key but different amount
   curl -X POST http://localhost:3000/payments \
     -H "Content-Type: application/json" \
     -d '{
       "sender_id": "uuid1",
       "receiver_id": "uuid2",
       "amount": 200,
       "idempotency_key": "test-key-123"
     }'
   # Should return 422 error
   ```

### Database Verification

```sql
-- Check idempotency records
SELECT * FROM idempotency_keys
ORDER BY created_at DESC
LIMIT 10;

-- Check for duplicate payments
SELECT payment_id, COUNT(*)
FROM idempotency_keys
WHERE status = 'completed'
GROUP BY payment_id
HAVING COUNT(*) > 1;

-- Manually trigger cleanup
SELECT cleanup_expired_idempotency_keys();
```

## Migration

The idempotency feature is **backward compatible**:

- `idempotency_key` is **optional** in all requests
- Requests without idempotency key work as before
- No breaking changes to existing API contracts

### Rollout Strategy

1. **Week 1**: Deploy backend (keys optional, no frontend changes)
2. **Week 2**: Update mobile app to include keys
3. **Week 3**: Monitor idempotency hit rate and tune cleanup frequency
4. **Week 4** (Optional): Make keys required for critical endpoints

## Monitoring

Key metrics to track:

1. **Idempotency hit rate**: % of requests that are duplicates
2. **Average wait time**: Time spent waiting for in-progress operations
3. **Failed operations**: Track retry patterns
4. **Table growth**: Size of `idempotency_keys` table

```sql
-- Idempotency statistics
SELECT
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM idempotency_keys
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY status;
```

## Troubleshooting

### Problem: Too many idempotency records

**Solution**:
- Check if cleanup job is running: `SELECT * FROM pg_stat_activity WHERE query LIKE '%cleanup_expired%'`
- Manually run cleanup: `SELECT cleanup_expired_idempotency_keys();`
- Reduce TTL: Update `ttl_seconds` in `IdempotencyConfig`

### Problem: 422 errors on legitimate retries

**Cause**: Request payload is changing between retries (e.g., timestamp fields)

**Solution**:
- Exclude volatile fields from idempotency hash
- Use consistent payload structure
- Generate timestamps on server-side, not client-side

### Problem: Payment succeeded but idempotency record shows failed

**Cause**: Race condition or network issue during status update

**Solution**:
- Check `payments` table for the payment
- Manually update idempotency record: `UPDATE idempotency_keys SET status='completed', payment_id='...' WHERE idempotency_key='...'`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Request                       │
│              (with optional idempotency_key)                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  IdempotencyService    │
                │  - Calculate hash      │
                │  - Check existing      │
                └────────┬───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐    ┌──────────┐    ┌─────────┐
    │ Proceed│    │ Already  │    │  Wait   │
    │        │    │Completed │    │for other│
    └────┬───┘    └────┬─────┘    └────┬────┘
         │             │               │
         ▼             │               │
┌────────────────┐     │               │
│Create record   │     │               │
│(distributed    │     │               │
│ lock)          │     │               │
└────┬───────────┘     │               │
     │                 │               │
     ▼                 │               │
┌────────────────┐     │               │
│Execute Stripe  │     │               │
│API call        │     │               │
└────┬───────────┘     │               │
     │                 │               │
     ▼                 ▼               ▼
┌────────────────────────────────────────┐
│      Return payment to client          │
└────────────────────────────────────────┘
```

## Implementation Files

- **Database**: [DB/migrations/022_create_idempotency_keys_table.sql](DB/migrations/022_create_idempotency_keys_table.sql)
- **Models**: [rust_BE/src/idempotency/models.rs](rust_BE/src/idempotency/models.rs)
- **Service**: [rust_BE/src/idempotency/service.rs](rust_BE/src/idempotency/service.rs)
- **Integration**: [rust_BE/src/persistences/payment_persistence.rs](rust_BE/src/persistences/payment_persistence.rs)
- **Initialization**: [rust_BE/src/main.rs](rust_BE/src/main.rs)
