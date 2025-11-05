# Architecture

## System Overview

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
│   (Expo/TS)     │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│   Rust Backend  │
│  (Axum/Tokio)   │
└────────┬────────┘
         │ SQLx
         │
┌────────▼────────┐       ┌──────────────┐
│   PostgreSQL    │       │   Stripe     │
│   Database      │◄──────┤   Payment    │
│   (Docker)      │       │   Gateway    │
└─────────────────┘       └──────────────┘
```

## Data Flow

### Event Browsing Flow
```
1. User opens app
   ↓
2. Home screen renders (app/(tabs)/index.tsx)
   ↓
3. useEvents hook executes
   ↓
4. HTTP GET request to http://127.0.0.1:3000/events
   ↓
5. Backend: event_controller::get_all_events
   ↓
6. Database: event_persistence::select_all_events
   ↓
7. SQLx queries PostgreSQL events table
   ↓
8. Returns Vec<EventEntity>
   ↓
9. Frontend receives Event[] array
   ↓
10. EventCard components render
```

### Payment Flow
```
1. User taps "RESERVE TABLE" button
   ↓
2. TableReservationModal opens
   ↓
3. User selects table and confirms
   ↓
4. HTTP POST to /payments with:
   - sender_id
   - receiver_id
   - amount
   ↓
5. Backend: payment_controller::create_payment
   ↓
6. Create Stripe PaymentIntent
   ↓
7. Store payment record in PostgreSQL
   ↓
8. Return PaymentEntity with client_secret
   ↓
9. Frontend receives payment confirmation
```

## Backend Architecture (MVC Pattern)

```
main.rs (Routes)
    ↓
Controllers (HTTP Layer)
    ↓
Persistence Layer (Database Operations)
    ↓
PostgreSQL Database
```

### Layer Responsibilities

**Routes (main.rs)**
- Define API endpoints
- Mount controllers
- Configure middleware
- Initialize application state

**Controllers**
- Handle HTTP requests/responses
- Validate input data
- Call persistence layer
- Return JSON responses
- Handle errors

**Persistence Layer**
- Execute SQL queries via SQLx
- Map database rows to models
- Handle database errors
- Manage transactions

**Models**
- Define data structures
- Implement serialization/deserialization
- Type validation

## Frontend Architecture

```
app/ (Expo Router)
    ↓
Screens/Tabs
    ↓
Components & Hooks
    ↓
API Calls (useEvents)
    ↓
Backend API
```

### Component Hierarchy

```
_layout.tsx (Root)
    ↓
(tabs)/_layout.tsx (Tab Navigator)
    ↓
├── index.tsx (Home)
│   ├── EventCard
│   │   └── EventDetailModal
│   │       └── TableReservationModal
│   └── ClubCard
├── search.tsx
├── tickets.tsx
└── profile.tsx
```

## Database Schema

### Events Table
```sql
events
  - id (UUID, PK)
  - title (VARCHAR)
  - description (TEXT)
  - completed (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Payments Table
```sql
payments
  - id (UUID, PK)
  - sender_id (VARCHAR)
  - receiver_id (VARCHAR)
  - amount (DECIMAL 10,2)
  - status (VARCHAR) -- 'Pending', 'Completed', 'Failed'
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

## API Design

**RESTful Endpoints:**
- `GET /events` - List all events
- `POST /events` - Create new event
- `GET /events/:id` - Get event details
- `DELETE /events/:id` - Delete event
- `GET /payments` - List payments (with filters)
- `POST /payments` - Create payment & PaymentIntent
- `GET /payments/:id` - Get payment details
- `DELETE /payments/:id` - Delete payment

**Response Format:**
All responses return JSON with appropriate HTTP status codes.

## Deployment Architecture

```
┌─────────────────────────────────┐
│         Development             │
├─────────────────────────────────┤
│ Frontend: Expo Go (localhost)   │
│ Backend: cargo run (port 3000)  │
│ Database: Docker (port 5432)    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│         Production (TBD)        │
├─────────────────────────────────┤
│ Frontend: Expo EAS Build        │
│ Backend: Cloud hosting           │
│ Database: Managed PostgreSQL    │
│ CDN: Static assets              │
└─────────────────────────────────┘
```

## Security Considerations

**Current State:**
- No authentication implemented
- No authorization checks
- Hardcoded database credentials
- No API rate limiting
- No input sanitization

**Recommended Improvements:**
- JWT-based authentication
- Role-based access control
- Environment variable configuration
- Rate limiting middleware
- SQL injection prevention (SQLx provides this)
- HTTPS in production
- CORS configuration