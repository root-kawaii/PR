# API Reference

Base URL: `http://127.0.0.1:3000`

## Events API

### List All Events

```http
GET /events
```

**Description**: Retrieves all events from the database

**Response**: `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Summer Music Festival",
    "description": "Annual music festival featuring top artists",
    "completed": false,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

**cURL Example**:
```bash
curl http://127.0.0.1:3000/events
```

---

### Create Event

```http
POST /events
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "Summer Music Festival",
  "description": "Annual music festival featuring top artists"
}
```

**Response**: `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Summer Music Festival",
  "description": "Annual music festival featuring top artists",
  "completed": false,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**cURL Example**:
```bash
curl -X POST http://127.0.0.1:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Summer Music Festival",
    "description": "Annual music festival"
  }'
```

---

### Get Event by ID

```http
GET /events/:id
```

**Parameters**:
- `id` (path, required) - Event UUID

**Response**: `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Summer Music Festival",
  "description": "Annual music festival featuring top artists",
  "completed": false,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**cURL Example**:
```bash
curl http://127.0.0.1:3000/events/550e8400-e29b-41d4-a716-446655440000
```

---

### Delete Event

```http
DELETE /events/:id
```

**Parameters**:
- `id` (path, required) - Event UUID

**Response**: `204 No Content`

**cURL Example**:
```bash
curl -X DELETE http://127.0.0.1:3000/events/550e8400-e29b-41d4-a716-446655440000
```

---

## Payments API

### List All Payments

```http
GET /payments
```

**Description**: Retrieves all payments, optionally filtered by query parameters

**Query Parameters**:
- `status` (optional) - Filter by payment status (Pending, Completed, Failed)
- `sender_id` (optional) - Filter by sender user ID
- `receiver_id` (optional) - Filter by receiver user ID

**Response**: `200 OK`

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "sender_id": "user_123",
    "receiver_id": "venue_456",
    "amount": 250.00,
    "status": "Completed",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z"
  }
]
```

**cURL Examples**:

All payments:
```bash
curl http://127.0.0.1:3000/payments
```

Filter by status:
```bash
curl "http://127.0.0.1:3000/payments?status=Completed"
```

Filter by sender:
```bash
curl "http://127.0.0.1:3000/payments?sender_id=user_123"
```

Multiple filters:
```bash
curl "http://127.0.0.1:3000/payments?status=Pending&sender_id=user_123"
```

---

### Create Payment

```http
POST /payments
Content-Type: application/json
```

**Description**: Creates a new payment and Stripe PaymentIntent

**Request Body**:
```json
{
  "sender_id": "user_123",
  "receiver_id": "venue_456",
  "amount": 250.00
}
```

**Response**: `201 Created`

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "sender_id": "user_123",
  "receiver_id": "venue_456",
  "amount": 250.00,
  "status": "Pending",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Process**:
1. Validates request data
2. Creates Stripe PaymentIntent with amount in cents
3. Stores payment in database with status "Pending"
4. Returns payment entity

**cURL Example**:
```bash
curl -X POST http://127.0.0.1:3000/payments \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user_123",
    "receiver_id": "venue_456",
    "amount": 250.00
  }'
```

---

### Get Payment by ID

```http
GET /payments/:id
```

**Parameters**:
- `id` (path, required) - Payment UUID

**Response**: `200 OK`

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "sender_id": "user_123",
  "receiver_id": "venue_456",
  "amount": 250.00,
  "status": "Completed",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**cURL Example**:
```bash
curl http://127.0.0.1:3000/payments/660e8400-e29b-41d4-a716-446655440000
```

---

### Delete Payment

```http
DELETE /payments/:id
```

**Parameters**:
- `id` (path, required) - Payment UUID

**Response**: `204 No Content`

**cURL Example**:
```bash
curl -X DELETE http://127.0.0.1:3000/payments/660e8400-e29b-41d4-a716-446655440000
```

---

## Error Responses

All endpoints may return the following error:

**500 Internal Server Error**
```json
{
  "error": "Internal server error"
}
```

**Common Causes**:
- Database connection failure
- Invalid UUID format
- Stripe API error
- Database query error

---

## Data Types

### EventEntity

```typescript
{
  id: string;              // UUID v4
  title: string;           // Max 255 characters
  description: string;     // Text
  completed: boolean;      // Default: false
  created_at: string;      // ISO 8601 timestamp
  updated_at: string;      // ISO 8601 timestamp
}
```

### PaymentEntity

```typescript
{
  id: string;              // UUID v4
  sender_id: string;       // User identifier
  receiver_id: string;     // User identifier
  amount: number;          // Decimal (10,2), must be > 0
  status: string;          // "Pending" | "Completed" | "Failed"
  created_at: string;      // ISO 8601 timestamp
  updated_at: string;      // ISO 8601 timestamp
}
```

---

## Payment Status Flow

```
POST /payments
    ↓
Status: "Pending"
    ↓
[Stripe webhook or manual update]
    ↓
Status: "Completed" or "Failed"
```

**Note**: Currently, status updates are not implemented. Payments remain in "Pending" status after creation.

---

## Rate Limiting

**Current**: No rate limiting implemented

**Recommendation**: Implement rate limiting middleware
- 100 requests per minute per IP
- 1000 requests per hour per IP

---

## Authentication

**Current**: No authentication required

**Future**: JWT-based authentication
```http
Authorization: Bearer <jwt_token>
```

---

## CORS

**Current**: No CORS configuration

**Recommendation**: Configure CORS for frontend domain
```rust
.layer(
    CorsLayer::new()
        .allow_origin("http://localhost:19000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_headers([CONTENT_TYPE])
)
```

---

## Testing the API

### Using cURL

Test events endpoint:
```bash
# Create event
curl -X POST http://127.0.0.1:3000/events \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Event", "description": "Testing API"}'

# Get all events
curl http://127.0.0.1:3000/events

# Get specific event (use ID from create response)
curl http://127.0.0.1:3000/events/{id}

# Delete event
curl -X DELETE http://127.0.0.1:3000/events/{id}
```

### Using HTTPie

```bash
# Install httpie
brew install httpie

# Create event
http POST :3000/events title="Test Event" description="Testing API"

# Get all events
http :3000/events

# Create payment
http POST :3000/payments sender_id=user_123 receiver_id=venue_456 amount=250.00
```

### Using Postman

1. Import collection from `docs/postman_collection.json`
2. Set base URL variable: `http://127.0.0.1:3000`
3. Test all endpoints

---

## WebSocket Support

**Current**: Not implemented

**Future**: Consider WebSocket for real-time updates
- Event availability changes
- Payment status updates
- Reservation confirmations