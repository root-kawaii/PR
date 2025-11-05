# Pierre Two - Documentation

This documentation provides quick context and reference for the Pierre Two project.

## Quick Links

- [Project Overview](./01-project-overview.md)
- [Architecture](./02-architecture.md)
- [Frontend Documentation](./03-frontend.md)
- [Backend Documentation](./04-backend.md)
- [Database Documentation](./05-database.md)
- [API Reference](./06-api-reference.md)
- [Development Setup](./07-development-setup.md)
- [Data Models](./08-data-models.md)

## Project Summary

**Pierre Two** is a full-stack mobile application for event booking and table reservations at clubs.

**Tech Stack:**
- Frontend: React Native (Expo) with TypeScript
- Backend: Rust with Axum framework
- Database: PostgreSQL 16 (Docker)
- Payments: Stripe API integration

## Quick Start

1. **Database**: `cd DB && docker-compose up -d`
2. **Backend**: `cd rust_BE && cargo run`
3. **Frontend**: `cd pierre_two && npm install && npx expo start`

## Key Directories

```
PR/
├── pierre_two/     # React Native frontend
├── rust_BE/        # Rust backend API
├── DB/             # PostgreSQL setup & schemas
└── docs/           # Project documentation
```