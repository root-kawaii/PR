# Authentication System Setup Complete

## Overview

A complete authentication system has been implemented across the entire stack:
- **Database**: Users and sessions tables
- **Backend**: Rust API with JWT authentication
- **Frontend**: React Native with login/register screens and auth context

---

## What Was Implemented

### 1. Database (PostgreSQL)

**New Tables:**
- [DB/migrations/003_create_users_table.sql](DB/migrations/003_create_users_table.sql) - Users table
- [DB/migrations/004_create_user_sessions_table.sql](DB/migrations/004_create_user_sessions_table.sql) - Sessions table (for future refresh tokens)

**Schema:**
```sql
users:
  - id (UUID, PK)
  - email (VARCHAR, UNIQUE)
  - password_hash (VARCHAR)
  - name (VARCHAR)
  - phone_number (VARCHAR, optional)
  - avatar_url (VARCHAR, optional)
  - created_at, updated_at

user_sessions:
  - id (UUID, PK)
  - user_id (UUID, FK to users)
  - refresh_token (VARCHAR)
  - expires_at (TIMESTAMP)
  - created_at
```

**Test User:**
- Email: `test@example.com`
- Password: `password123`

### 2. Backend (Rust)

**New Files:**
- [rust_BE/src/models/user.rs](rust_BE/src/models/user.rs) - User models and DTOs
- [rust_BE/src/persistences/user_persistence.rs](rust_BE/src/persistences/user_persistence.rs) - Database operations
- [rust_BE/src/controllers/auth_controller.rs](rust_BE/src/controllers/auth_controller.rs) - Auth endpoints
- [rust_BE/src/utils/jwt.rs](rust_BE/src/utils/jwt.rs) - JWT token generation/validation

**New Dependencies (Cargo.toml):**
- `bcrypt = "0.15"` - Password hashing
- `jsonwebtoken = "9"` - JWT tokens

**API Endpoints:**
```
POST /auth/register
  Body: { email, password, name, phone_number? }
  Response: { user, token }

POST /auth/login
  Body: { email, password }
  Response: { user, token }
```

**Environment Variables (rust_BE/.env):**
```env
JWT_SECRET=your-secret-key-change-this-in-production
STRIPE_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://postgres:password@localhost:5432/events
```

### 3. Frontend (React Native)

**New Files:**
- [pierre_two/types/index.ts](pierre_two/types/index.ts) - Auth TypeScript types
- [pierre_two/context/AuthContext.tsx](pierre_two/context/AuthContext.tsx) - Auth state management
- [pierre_two/app/login.tsx](pierre_two/app/login.tsx) - Login screen
- [pierre_two/app/register.tsx](pierre_two/app/register.tsx) - Register screen

**Updated Files:**
- [pierre_two/app/_layout.tsx](pierre_two/app/_layout.tsx) - Added AuthProvider and route protection
- [pierre_two/app/(tabs)/profile.tsx](pierre_two/app/(tabs)/profile.tsx) - Added user info and logout

**New Dependency:**
- `@react-native-async-storage/async-storage` - Token persistence

**Features:**
- Auto-redirect to login if not authenticated
- Auto-redirect to home if already authenticated
- Token persistence (survives app restart)
- Logout functionality

---

## Setup Instructions

### 1. Database

```bash
cd DB
./start.sh --fresh  # Fresh start to apply new migrations
```

This will create the users and user_sessions tables automatically.

### 2. Backend

```bash
cd rust_BE

# Install new dependencies
cargo build

# Add JWT secret to .env (create if doesn't exist)
echo "JWT_SECRET=my-super-secret-jwt-key-change-in-production" >> .env

# Run the server
cargo run
```

Server will start on `http://127.0.0.1:3000` with the following endpoints:
- POST `/auth/register`
- POST `/auth/login`
- GET/POST `/events`
- GET/POST `/payments`

### 3. Frontend

```bash
cd pierre_two

# Install new dependencies
npm install

# Start Expo
npx expo start
```

---

## Testing the Authentication

### Option 1: Use Test User

1. Start the app
2. You'll see the login screen
3. Login with:
   - **Email**: `test@example.com`
   - **Password**: `password123`

### Option 2: Create New Account

1. Start the app
2. Tap "Sign Up" on the login screen
3. Fill in the registration form
4. Account will be created and you'll be logged in automatically

### Option 3: API Testing with cURL

**Register:**
```bash
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepass123",
    "name": "John Doe",
    "phone_number": "+1234567890"
  }'
```

**Login:**
```bash
curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "phone_number": "+1234567890",
    "avatar_url": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Authentication Flow

1. **User Opens App**
   - AuthContext checks AsyncStorage for saved token
   - If token exists → redirect to home (tabs)
   - If no token → show login screen

2. **User Logs In**
   - Submit email/password to `/auth/login`
   - Backend validates credentials with bcrypt
   - Backend generates JWT token (valid for 7 days)
   - Frontend saves token and user to AsyncStorage
   - Redirect to home (tabs)

3. **User Navigates App**
   - Token is automatically included in API requests (when implemented)
   - AuthContext provides user data to all screens
   - Protected routes check `isAuthenticated` before rendering

4. **User Logs Out**
   - Clear token and user from AsyncStorage
   - Clear state in AuthContext
   - Redirect to login screen

---

## Using Authentication in Components

```typescript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, token, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Text>Please log in</Text>;
  }

  return (
    <View>
      <Text>Welcome, {user?.name}!</Text>
      <Text>Email: {user?.email}</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

---

## Making Authenticated API Requests

To protect API endpoints, add the token to request headers:

```typescript
const { token } = useAuth();

const response = await fetch('http://127.0.0.1:3000/events', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

**Backend middleware for protected routes** (future implementation):
```rust
// Create middleware to extract and validate JWT from Authorization header
// Then pass user_id to handlers
```

---

## Security Features

✅ **Implemented:**
- Password hashing with bcrypt (cost: 12)
- JWT tokens with expiration (7 days)
- Email uniqueness constraint
- Password minimum length validation (6 chars)
- Secure token storage in AsyncStorage
- HTTP status codes for errors

⚠️ **TODO for Production:**
- [ ] Add HTTPS/TLS for API
- [ ] Implement refresh tokens
- [ ] Add rate limiting for auth endpoints
- [ ] Add email verification
- [ ] Add password reset functionality
- [ ] Add 2FA support
- [ ] Add account lockout after failed attempts
- [ ] Add CORS configuration
- [ ] Use stronger JWT secret (min 32 characters)
- [ ] Add token blacklisting for logout
- [ ] Add password strength requirements
- [ ] Add input sanitization

---

## Common Issues & Solutions

### Issue: "Failed to connect to database"
**Solution**: Make sure PostgreSQL is running
```bash
cd DB && ./start.sh
```

### Issue: "STRIPE_SECRET_KEY must be set"
**Solution**: Add Stripe key to .env
```bash
cd rust_BE
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env
```

### Issue: "Module not found: @react-native-async-storage"
**Solution**: Install dependencies
```bash
cd pierre_two
npm install
```

### Issue: Login fails with test user
**Solution**: Make sure migrations ran
```bash
cd DB
./start.sh --fresh
```

### Issue: "Network request failed" on login
**Solution**: Update API_URL in AuthContext.tsx based on your device:
- iOS Simulator: `http://127.0.0.1:3000`
- Android Emulator: `http://10.0.2.2:3000`
- Physical Device: `http://YOUR_IP:3000`

---

## File Structure Summary

```
PR/
├── DB/
│   └── migrations/
│       ├── 003_create_users_table.sql
│       └── 004_create_user_sessions_table.sql
│
├── rust_BE/
│   ├── src/
│   │   ├── models/
│   │   │   └── user.rs
│   │   ├── controllers/
│   │   │   └── auth_controller.rs
│   │   ├── persistences/
│   │   │   └── user_persistence.rs
│   │   ├── utils/
│   │   │   ├── mod.rs
│   │   │   └── jwt.rs
│   │   └── main.rs (updated)
│   ├── Cargo.toml (updated)
│   └── .env (add JWT_SECRET)
│
└── pierre_two/
    ├── context/
    │   └── AuthContext.tsx
    ├── app/
    │   ├── _layout.tsx (updated)
    │   ├── login.tsx
    │   ├── register.tsx
    │   └── (tabs)/
    │       └── profile.tsx (updated)
    ├── types/
    │   └── index.ts (updated)
    └── package.json (updated)
```

---

## Next Steps

1. **Add Protected Routes**: Create middleware to protect event/payment endpoints
2. **Add Profile Editing**: Allow users to update name, phone, avatar
3. **Add Password Change**: Allow users to change password
4. **Add Refresh Tokens**: Implement token refresh for better security
5. **Add Social Login**: OAuth with Google, Facebook, Apple
6. **Add Email Verification**: Send verification emails on registration
7. **Add Password Reset**: Forgot password functionality

---

**Authentication system is now fully functional!** 🎉

Users can register, login, and logout. The system persists authentication across app restarts and automatically handles route protection.