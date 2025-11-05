# Backend Documentation

## Technology

- **Framework**: Axum 0.7
- **Runtime**: Tokio (async)
- **Database**: SQLx 0.7 with PostgreSQL
- **Language**: Rust
- **Location**: `/rust_BE/`

## Project Structure

```
rust_BE/
├── src/
│   ├── main.rs                      # Server entry & routes
│   ├── models/
│   │   ├── mod.rs
│   │   ├── event_entity.rs          # Event model
│   │   └── payment_entity.rs        # Payment model
│   ├── controllers/
│   │   ├── mod.rs
│   │   ├── event_controller.rs      # Event handlers
│   │   └── payment_controller.rs    # Payment handlers
│   └── persistences/
│       ├── mod.rs
│       ├── event_persistence.rs     # Event DB operations
│       └── payment_persistence.rs   # Payment DB operations
├── Cargo.toml                        # Rust dependencies
└── Cargo.lock
```

## Application Entry Point

**Location**: [src/main.rs](../rust_BE/src/main.rs)

### Server Configuration

```rust
#[tokio::main]
async fn main() {
    // Database connection pool
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect("postgresql://postgres:password@localhost:5432/events")
        .await
        .expect("Failed to connect to Postgres");

    let app_state = AppState { db: pool };

    // Define routes
    let app = Router::new()
        .route("/events", get(get_all_events).post(create_event))
        .route("/events/:id", get(get_event_by_id).delete(delete_event))
        .route("/payments", get(get_all_payments).post(create_payment))
        .route("/payments/:id", get(get_payment_by_id).delete(delete_payment))
        .with_state(app_state);

    // Start server
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
```

### AppState

```rust
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}
```

## API Endpoints

### Events API

#### GET /events
**Handler**: `event_controller::get_all_events`
**Description**: Returns all events from database
**Response**: `200 OK` with `Vec<EventEntity>`

```json
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "completed": false,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### POST /events
**Handler**: `event_controller::create_event`
**Description**: Creates a new event
**Request Body**:
```json
{
  "title": "string",
  "description": "string"
}
```
**Response**: `201 Created` with created `EventEntity`

#### GET /events/:id
**Handler**: `event_controller::get_event_by_id`
**Description**: Get single event by UUID
**Response**: `200 OK` with `EventEntity`

#### DELETE /events/:id
**Handler**: `event_controller::delete_event`
**Description**: Delete event by UUID
**Response**: `204 No Content`

### Payments API

#### GET /payments
**Handler**: `payment_controller::get_all_payments`
**Description**: List all payments with optional filters
**Query Parameters**:
- `status` (optional): Filter by payment status
- `sender_id` (optional): Filter by sender
- `receiver_id` (optional): Filter by receiver

**Example**: `GET /payments?status=Completed&sender_id=user123`

**Response**: `200 OK` with `Vec<PaymentEntity>`

```json
[
  {
    "id": "uuid",
    "sender_id": "string",
    "receiver_id": "string",
    "amount": 250.00,
    "status": "Completed",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### POST /payments
**Handler**: `payment_controller::create_payment`
**Description**: Create payment and Stripe PaymentIntent
**Request Body**:
```json
{
  "sender_id": "string",
  "receiver_id": "string",
  "amount": 250.00
}
```

**Process**:
1. Validate input
2. Create Stripe PaymentIntent
3. Store payment in PostgreSQL with status "Pending"
4. Return PaymentEntity with client_secret

**Response**: `201 Created` with `PaymentEntity`

#### GET /payments/:id
**Handler**: `payment_controller::get_payment_by_id`
**Description**: Get single payment by UUID
**Response**: `200 OK` with `PaymentEntity`

#### DELETE /payments/:id
**Handler**: `payment_controller::delete_payment`
**Description**: Delete payment by UUID
**Response**: `204 No Content`

## Models

### EventEntity
**Location**: [src/models/event_entity.rs](../rust_BE/src/models/event_entity.rs)

```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct EventEntity {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: String,
}
```

### PaymentEntity
**Location**: [src/models/payment_entity.rs](../rust_BE/src/models/payment_entity.rs)

```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PaymentEntity {
    pub id: Uuid,
    pub sender_id: String,
    pub receiver_id: String,
    pub amount: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub sender_id: String,
    pub receiver_id: String,
    pub amount: Decimal,
}
```

## Controllers

### Event Controller
**Location**: [src/controllers/event_controller.rs](../rust_BE/src/controllers/event_controller.rs:1)

**Functions**:
- `get_all_events` - Lists all events
- `create_event` - Creates new event
- `get_event_by_id` - Fetches single event
- `delete_event` - Removes event

**Example**:
```rust
pub async fn get_all_events(
    State(state): State<AppState>,
) -> Result<Json<Vec<EventEntity>>, StatusCode> {
    match event_persistence::select_all_events(&state.db).await {
        Ok(events) => Ok(Json(events)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
```

### Payment Controller
**Location**: [src/controllers/payment_controller.rs](../rust_BE/src/controllers/payment_controller.rs:1)

**Functions**:
- `get_all_payments` - Lists payments with filters
- `create_payment` - Creates payment + Stripe intent
- `get_payment_by_id` - Fetches single payment
- `delete_payment` - Removes payment

**Stripe Integration**:
```rust
pub async fn create_payment(
    State(state): State<AppState>,
    Json(payload): Json<CreatePaymentRequest>,
) -> Result<Json<PaymentEntity>, StatusCode> {
    // Create Stripe PaymentIntent
    let stripe_client = stripe::Client::new(env::var("STRIPE_SECRET_KEY").unwrap());
    let payment_intent = PaymentIntent::create(
        &stripe_client,
        CreatePaymentIntent {
            amount: (payload.amount * Decimal::from(100)).to_i64().unwrap(),
            currency: Currency::USD,
            ..Default::default()
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store in database
    let payment = payment_persistence::insert_payment(
        &state.db,
        payload.sender_id,
        payload.receiver_id,
        payload.amount,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(payment))
}
```

## Persistence Layer

### Event Persistence
**Location**: [src/persistences/event_persistence.rs](../rust_BE/src/persistences/event_persistence.rs:1)

**Functions**:

```rust
// Fetch all events
pub async fn select_all_events(pool: &PgPool) -> Result<Vec<EventEntity>, sqlx::Error> {
    sqlx::query_as::<_, EventEntity>("SELECT * FROM events ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
}

// Create event
pub async fn insert_event(
    pool: &PgPool,
    title: String,
    description: String,
) -> Result<EventEntity, sqlx::Error> {
    sqlx::query_as::<_, EventEntity>(
        "INSERT INTO events (id, title, description, completed, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(title)
    .bind(description)
    .bind(false)
    .bind(Utc::now())
    .bind(Utc::now())
    .fetch_one(pool)
    .await
}

// Fetch by ID
pub async fn select_event_by_id(pool: &PgPool, id: Uuid) -> Result<EventEntity, sqlx::Error>

// Delete by ID
pub async fn delete_event_by_id(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error>
```

### Payment Persistence
**Location**: [src/persistences/payment_persistence.rs](../rust_BE/src/persistences/payment_persistence.rs:1)

**Functions**:

```rust
// Fetch all payments
pub async fn select_all_payments(pool: &PgPool) -> Result<Vec<PaymentEntity>, sqlx::Error>

// Fetch with filters
pub async fn select_filtered_payments(
    pool: &PgPool,
    status: Option<String>,
    sender_id: Option<String>,
    receiver_id: Option<String>,
) -> Result<Vec<PaymentEntity>, sqlx::Error>

// Create payment
pub async fn insert_payment(
    pool: &PgPool,
    sender_id: String,
    receiver_id: String,
    amount: Decimal,
) -> Result<PaymentEntity, sqlx::Error>

// Fetch by ID
pub async fn select_payment_by_id(pool: &PgPool, id: Uuid) -> Result<PaymentEntity, sqlx::Error>

// Delete by ID
pub async fn delete_payment_by_id(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error>
```

## Dependencies

**Key Crates** (see [Cargo.toml](../rust_BE/Cargo.toml)):

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
axum = "0.7"
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio", "uuid", "chrono"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.0", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
rust_decimal = { version = "1.33", features = ["serde"] }
stripe-rust = "0.20"
```

## Running the Backend

```bash
cd rust_BE

# Build
cargo build

# Run (development)
cargo run

# Run (release)
cargo run --release

# Server starts on http://127.0.0.1:3000
```

## Environment Variables

**Required**:
```bash
STRIPE_SECRET_KEY=sk_test_xxxxx
DATABASE_URL=postgresql://postgres:password@localhost:5432/events
```

## Error Handling

Currently using basic HTTP status codes:
- `200 OK` - Successful GET
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `500 Internal Server Error` - Database or processing errors

**TODO**: Implement proper error types and detailed error messages

## Testing

```bash
# Run tests
cargo test

# Run with output
cargo test -- --nocapture
```

**Current State**: No tests implemented

## Performance Considerations

- **Connection Pooling**: Max 5 connections configured
- **Async I/O**: All operations non-blocking via Tokio
- **Prepared Statements**: SQLx compiles queries at compile-time
- **Type Safety**: Rust prevents runtime type errors

## Security Notes

**Current Issues**:
- Database credentials hardcoded
- No authentication middleware
- No rate limiting
- CORS not configured
- No request validation

**Recommendations**:
- Use environment variables for secrets
- Implement JWT authentication
- Add rate limiting middleware
- Configure CORS properly
- Use validation crate for input