# 2026-04-22: Local Development Setup — CORS, Rate Limiter & Dashboard Crash Fix

**Branch**: `develop`
**Status**: Done

---

## Overview

First-time local setup of the dashboard + backend on Windows revealed three bugs that only surface in local development:

1. **Backend 500 on all auth routes in local** — `GovernorLayer` (rate limiter) uses `SmartIpKeyExtractor` to read the client IP, but `axum::serve` was called without `into_make_service_with_connect_info`, so the IP was never injected. In production Fly.io provides `X-Forwarded-For`; locally there is no such header.
2. **CORS block for dashboard dev server** — `localhost:5173` (Vite default) was not in the backend's allowed-origins list.
3. **Dashboard crash on ClubSettingsPage** — `imagesData?.images.length` crashed when `images` was `undefined`; needed double optional chaining.

---

## Changes

### Backend (rust_BE)

#### `src/main.rs`
Added `into_make_service_with_connect_info::<SocketAddr>()` so Tower/Axum injects the peer `SocketAddr` into every request, making `SmartIpKeyExtractor` work without a reverse-proxy header.

#### `src/api/mod.rs`
Added `http://localhost:5173` and `https://localhost:5173` to the hardcoded CORS allowed-origins list (Vite dev server; Edge sometimes upgrades localhost to HTTPS).

#### `src/controllers/club_owner_controller.rs`
Added `tracing::error!` in the DB-error and bcrypt-error branches of `login_club_owner` for easier future debugging.

### Dashboard (pierre_dashboard)

#### `src/pages/ClubSettingsPage.tsx`
Changed `imagesData?.images.length` → `imagesData?.images?.length` in both the `useEffect` body and its dependency array to prevent a crash when `images` is `undefined` during initial load.

---

## Files Modified

| File | Change |
|------|--------|
| `rust_BE/src/main.rs` | `into_make_service_with_connect_info` fix |
| `rust_BE/src/api/mod.rs` | CORS: add localhost:5173 |
| `rust_BE/src/controllers/club_owner_controller.rs` | Error logging in login handler |
| `pierre_dashboard/src/pages/ClubSettingsPage.tsx` | Double optional chaining fix |
