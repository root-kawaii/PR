# Project Overview

## What is Pierre Two?

Pierre Two is a mobile application for event discovery and table reservations at nightclubs and entertainment venues. Users can browse events, view club details, and reserve tables with integrated payment processing.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React Native | 0.81.4 |
| Frontend Build | Expo | 54.0.13 |
| Frontend Router | Expo Router | 6.0.11 |
| Frontend Language | TypeScript | 5.9.2 |
| Backend Framework | Axum | 0.7 |
| Backend Runtime | Tokio | 1.x |
| Database Library | SQLx | 0.7 |
| Database | PostgreSQL | 16 |
| Container | Docker | Latest |
| Payments | Stripe API | async-stripe |

## Project Structure

```
PR/
├── pierre_two/           # React Native mobile app
│   ├── app/             # Expo Router pages
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript definitions
│   └── constants/       # Config and mock data
│
├── rust_BE/             # Rust backend server
│   └── src/
│       ├── main.rs      # Server entry & routes
│       ├── models/      # Data structures
│       ├── controllers/ # Request handlers
│       └── persistences/# Database operations
│
└── DB/                  # Database setup
    ├── docker-compose.yaml
    ├── events.sql       # Events table schema
    └── payments.sql     # Payments table schema
```

## Key Features

### Current Features
- Event listing and browsing
- Club and genre discovery
- Event detail views
- Table reservation UI
- Payment processing with Stripe
- RESTful API for events and payments

### Planned Features
- User authentication
- Real-time availability
- Push notifications
- Event updates
- Payment webhooks
- Reservation management

## Architecture Principles

1. **Type Safety**: Full type coverage with TypeScript and Rust
2. **Async-First**: Non-blocking I/O for scalability
3. **Clean Architecture**: MVC pattern with clear separation of concerns
4. **Containerization**: Docker for consistent environments
5. **Modern Patterns**: File-based routing, hooks, async/await