# Data Models

Complete reference for all data structures used throughout the Pierre Two application.

---

## Frontend Models (TypeScript)

**Location**: [pierre_two/types/index.ts](../pierre_two/types/index.ts)

### Event

Represents a nightclub event or show.

```typescript
export interface Event {
  id: string;              // Unique identifier (UUID)
  title: string;           // Event name
  description: string;     // Full event description
  date: string;            // Event date/time (ISO 8601)
  location: string;        // Venue address
  imageUrl: string;        // Event promotional image
  genre: string;           // Music genre (e.g., "Techno", "House")
  price: number;           // Entry price or starting price
  club: Club;              // Associated venue
  tables: Table[];         // Available tables for reservation
}
```

**Example**:
```json
{
  "id": "e1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6",
  "title": "Neon Nights Festival",
  "description": "The biggest electronic music festival of the year",
  "date": "2024-07-20T22:00:00Z",
  "location": "Downtown Arena, 123 Main St",
  "imageUrl": "https://example.com/event.jpg",
  "genre": "Techno",
  "price": 50.00,
  "club": { /* Club object */ },
  "tables": [ /* Array of Table objects */ ]
}
```

---

### Club

Represents a nightclub or venue.

```typescript
export interface Club {
  id: string;              // Unique identifier
  name: string;            // Venue name
  address: string;         // Full address
  imageUrl: string;        // Venue image
  rating: number;          // User rating (0-5)
  description?: string;    // Optional venue description
  capacity?: number;       // Optional max capacity
}
```

**Example**:
```json
{
  "id": "c1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6",
  "name": "The Velvet Lounge",
  "address": "456 Club Ave, City, State",
  "imageUrl": "https://example.com/club.jpg",
  "rating": 4.5,
  "description": "Premium nightlife experience",
  "capacity": 500
}
```

---

### Table

Represents a reservable table at a venue.

```typescript
export interface Table {
  id: string;              // Unique identifier
  number: string;          // Table number/name (e.g., "VIP-1", "A5")
  capacity: number;        // Number of people (min)
  price: number;           // Reservation price
  available: boolean;      // Availability status
  location?: string;       // Optional table location (e.g., "VIP Section")
  amenities?: string[];    // Optional features (e.g., ["Bottle Service"])
}
```

**Example**:
```json
{
  "id": "t1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6",
  "number": "VIP-1",
  "capacity": 6,
  "price": 500.00,
  "available": true,
  "location": "VIP Section - Main Floor",
  "amenities": ["Bottle Service", "Dedicated Server"]
}
```

---

### Genre

Represents a music genre category.

```typescript
export interface Genre {
  id: string;              // Unique identifier
  name: string;            // Genre name
  imageUrl: string;        // Genre icon/image
  eventCount?: number;     // Optional number of events
}
```

**Example**:
```json
{
  "id": "g1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6",
  "name": "Techno",
  "imageUrl": "https://example.com/genres/techno.jpg",
  "eventCount": 15
}
```

---

### User (Not Implemented)

Future user model for authentication.

```typescript
export interface User {
  id: string;              // Unique identifier
  email: string;           // User email
  name: string;            // Full name
  phoneNumber?: string;    // Optional phone
  avatar?: string;         // Optional profile picture
  createdAt: string;       // Account creation date
}
```

---

### Reservation (Not Implemented)

Future model for table reservations.

```typescript
export interface Reservation {
  id: string;              // Unique identifier
  userId: string;          // User making reservation
  eventId: string;         // Associated event
  tableId: string;         // Reserved table
  paymentId: string;       // Payment record
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;       // Reservation timestamp
  numberOfGuests: number;  // Party size
}
```

---

## Backend Models (Rust)

### EventEntity

**Location**: [rust_BE/src/models/event_entity.rs](../rust_BE/src/models/event_entity.rs)

Represents an event in the database.

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
```

**Fields**:
- `id`: UUID v4 primary key
- `title`: Event title (max 255 chars)
- `description`: Full description (text)
- `completed`: Boolean flag (currently unused)
- `created_at`: Timestamp with timezone
- `updated_at`: Timestamp with timezone

**Traits**:
- `Debug`: For debugging output
- `Serialize`: JSON serialization via serde
- `Deserialize`: JSON deserialization via serde
- `sqlx::FromRow`: Automatic mapping from database row

---

### CreateEventRequest

Request payload for creating an event.

```rust
#[derive(Debug, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: String,
}
```

**Validation** (Future):
```rust
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateEventRequest {
    #[validate(length(min = 1, max = 255))]
    pub title: String,

    #[validate(length(min = 1, max = 5000))]
    pub description: String,
}
```

---

### PaymentEntity

**Location**: [rust_BE/src/models/payment_entity.rs](../rust_BE/src/models/payment_entity.rs)

Represents a payment record in the database.

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
```

**Fields**:
- `id`: UUID v4 primary key
- `sender_id`: User ID of payer
- `receiver_id`: User ID of recipient (venue/club)
- `amount`: Decimal (10,2) - payment amount
- `status`: Payment status string
- `created_at`: Timestamp with timezone
- `updated_at`: Timestamp with timezone

**Status Values**:
```rust
pub enum PaymentStatus {
    Pending,    // Initial state after creation
    Completed,  // Payment successfully processed
    Failed,     // Payment declined or error
}

impl PaymentStatus {
    pub fn as_str(&self) -> &str {
        match self {
            PaymentStatus::Pending => "Pending",
            PaymentStatus::Completed => "Completed",
            PaymentStatus::Failed => "Failed",
        }
    }
}
```

---

### CreatePaymentRequest

Request payload for creating a payment.

```rust
#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub sender_id: String,
    pub receiver_id: String,
    pub amount: Decimal,
}
```

**Validation** (Future):
```rust
#[derive(Debug, Deserialize, Validate)]
pub struct CreatePaymentRequest {
    #[validate(length(min = 1, max = 255))]
    pub sender_id: String,

    #[validate(length(min = 1, max = 255))]
    pub receiver_id: String,

    #[validate(range(min = 0.01, max = 99999999.99))]
    pub amount: Decimal,
}
```

---

### AppState

Application state passed to all handlers.

```rust
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,  // PostgreSQL connection pool
}
```

**Usage in handlers**:
```rust
pub async fn handler(State(state): State<AppState>) -> Response {
    let pool = &state.db;
    // Use pool for database operations
}
```

---

## Database Schema

### events Table

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes**:
```sql
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_completed ON events(completed);
```

---

### payments Table

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_amount_positive CHECK (amount > 0)
);
```

**Indexes**:
```sql
CREATE INDEX idx_payments_sender ON payments(sender_id);
CREATE INDEX idx_payments_receiver ON payments(receiver_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

---

## Type Mappings

### TypeScript ↔ Rust ↔ PostgreSQL

| TypeScript | Rust | PostgreSQL | Notes |
|------------|------|------------|-------|
| string | String | VARCHAR/TEXT | Text data |
| number | i32/i64 | INTEGER/BIGINT | Integers |
| number | f64 | DOUBLE PRECISION | Floats |
| number | Decimal | DECIMAL(10,2) | Precise decimals |
| string | Uuid | UUID | UUIDs |
| string | DateTime<Utc> | TIMESTAMP WITH TIME ZONE | Timestamps |
| boolean | bool | BOOLEAN | True/false |
| string[] | Vec<String> | TEXT[] | Arrays |
| object | struct | JSONB | JSON data |

---

## Data Validation

### Frontend Validation (Future)

Using Zod for runtime validation:

```typescript
import { z } from 'zod';

const EventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  date: z.string().datetime(),
  price: z.number().positive(),
  // ...
});

type Event = z.infer<typeof EventSchema>;
```

### Backend Validation (Future)

Using validator crate:

```rust
use validator::{Validate, ValidationError};

#[derive(Debug, Deserialize, Validate)]
pub struct CreateEventRequest {
    #[validate(length(min = 1, max = 255))]
    pub title: String,

    #[validate(length(min = 1, max = 5000))]
    pub description: String,
}

// In handler
pub async fn create_event(
    State(state): State<AppState>,
    Json(payload): Json<CreateEventRequest>,
) -> Result<Json<EventEntity>, StatusCode> {
    payload.validate()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    // ... rest of handler
}
```

---

## Future Models

### UserEntity

```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserEntity {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### ReservationEntity

```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReservationEntity {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_id: Uuid,
    pub table_id: Uuid,
    pub payment_id: Uuid,
    pub status: String,
    pub number_of_guests: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### VenueEntity

```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct VenueEntity {
    pub id: Uuid,
    pub name: String,
    pub address: String,
    pub image_url: String,
    pub rating: f64,
    pub capacity: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

---

## Model Relationships (Future)

```
User
  ├─ has many Reservations
  └─ has many Payments (as sender)

Event
  ├─ belongs to Venue
  ├─ has many Tables
  └─ has many Reservations

Reservation
  ├─ belongs to User
  ├─ belongs to Event
  ├─ belongs to Table
  └─ has one Payment

Payment
  ├─ belongs to User (sender)
  ├─ belongs to Venue (receiver)
  └─ belongs to Reservation
```

**Implementation**:
```sql
ALTER TABLE reservations
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  ADD CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES events(id),
  ADD CONSTRAINT fk_table FOREIGN KEY (table_id) REFERENCES tables(id),
  ADD CONSTRAINT fk_payment FOREIGN KEY (payment_id) REFERENCES payments(id);
```