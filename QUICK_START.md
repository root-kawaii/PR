# Quick Start Guide - Pierre Two with Authentication

## 🚀 Quick Setup (3 Steps)

### 1. Start Database
```bash
cd DB
./start.sh --fresh
```
Wait for: ✅ Database is ready!

### 2. Start Backend
```bash
cd rust_BE
cargo run
```
Wait for: 🚀 Server running on http://127.0.0.1:3000

### 3. Start Frontend
```bash
cd pierre_two
npm install
npx expo start
```
Then press 'i' for iOS or 'a' for Android

---

## 🔐 Login

**Test Account:**
- Email: `test@example.com`
- Password: `password123`

Or tap **"Sign Up"** to create a new account!

---

## ✅ What's Working

- ✅ User registration & login
- ✅ JWT authentication (7-day tokens)
- ✅ Password hashing (bcrypt)
- ✅ Token persistence (survives app restart)
- ✅ Auto-redirect (login ↔ home)
- ✅ Protected routes
- ✅ User profile with logout
- ✅ Event browsing (existing feature)
- ✅ Payment system (existing feature)

---

## 📝 API Endpoints

**Authentication:**
- `POST /auth/register` - Create account
- `POST /auth/login` - Login

**Events:**
- `GET /events` - List events
- `POST /events` - Create event
- `GET /events/:id` - Get event
- `DELETE /events/:id` - Delete event

**Payments:**
- `GET /payments` - List payments
- `POST /payments` - Create payment (with Stripe)
- `GET /payments/:id` - Get payment
- `DELETE /payments/:id` - Delete payment

---

## 🧪 Test with cURL

```bash
# Register
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"test123","name":"Test User"}'

# Login
curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 📂 Project Structure

```
PR/
├── DB/                    # PostgreSQL + migrations
│   ├── migrations/
│   │   ├── 001_create_events_table.sql
│   │   ├── 002_create_payments_table.sql
│   │   ├── 003_create_users_table.sql
│   │   └── 004_create_user_sessions_table.sql
│   ├── start.sh          # Easy database startup
│   └── docker-compose.yaml
│
├── rust_BE/              # Rust API server
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── persistences/ # Database operations
│   │   ├── models/       # Data structures
│   │   ├── utils/        # JWT helpers
│   │   └── main.rs
│   └── Cargo.toml
│
└── pierre_two/           # React Native app
    ├── app/
    │   ├── (tabs)/       # Home, Search, Tickets, Profile
    │   ├── login.tsx
    │   ├── register.tsx
    │   └── _layout.tsx
    ├── context/
    │   └── AuthContext.tsx
    └── package.json
```

---

## 🔧 Troubleshooting

**Backend won't start:**
```bash
# Add JWT secret
cd rust_BE
echo "JWT_SECRET=my-secret-key" >> .env
```

**Frontend can't connect:**
- iOS Simulator: Works with `127.0.0.1:3000` ✅
- Android Emulator: Use `10.0.2.2:3000`
- Physical Device: See "Physical Device Testing" below ⚠️

**Physical Device Testing:**
Your router may have AP Isolation enabled, which blocks device-to-device communication. Solutions:
1. **Disable firewall temporarily**: `System Settings` → `Network` → `Firewall` → Turn Off
2. **Allow rust_BE in firewall**: Add `target/debug/rust_BE` to allowed apps
3. **Use ngrok tunnel** (requires free account at ngrok.com):
   ```bash
   brew install ngrok/ngrok/ngrok
   ngrok config add-authtoken YOUR_TOKEN
   ngrok http 3000
   # Then update AuthContext.tsx line 28 with the ngrok URL
   ```
4. **Use mobile hotspot**: Connect your Mac to your phone's hotspot, then connect your phone to that same hotspot

**Migrations not running:**
```bash
cd DB
./start.sh --fresh  # Clean restart
```

---

## 📚 Full Documentation

- [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md) - Complete auth guide
- [docs/](./docs/) - Full project documentation

---

**Everything is ready!** Start coding! 🎉