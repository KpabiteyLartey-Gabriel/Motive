# GH Motive — Architecture

## Overview

GH Motive is built as a **modular monolith** on three primary applications sharing a single backend API.

```
                 GH MOTIVE
                     │
        ┌────────────┼────────────┐
        │            │            │
     BACKEND        WEB         MOBILE
     NestJS       Next.js       Expo
        │            │            │
        └────────────┼────────────┘
                     │
                REST API (JWT)
                     │
                PostgreSQL
                     │
        ┌────────────┼────────────┐
        │            │            │
     Payments     Storage      Notifications
    (MTN MoMo)  (S3/Local)    (SMS/Email/Push)
```

## Core Principle

The **backend is authoritative**. Neither the web application nor the mobile application independently determine:

- Payment success or failure
- Contract validity
- Ownership
- Payment balance
- Ownership-transfer eligibility
- Settlement status
- User permissions
- Financial totals

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend API | NestJS (Node.js) |
| Database | PostgreSQL via Prisma ORM |
| Cache/Queue | Redis + BullMQ |
| Web | Next.js 14 + React + Tailwind CSS |
| Mobile | Expo + React Native |
| Payments | MTN MoMo (via abstraction layer) |

## Module Architecture

```
apps/backend/src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── config/                    # Environment configuration
├── prisma/                    # Prisma service + module
├── health/                    # Health check endpoints
├── common/
│   ├── filters/               # Global exception filters
│   ├── interceptors/          # Transform + Logging interceptors
│   └── guards/                # Auth guards
└── modules/
    ├── auth/                  # Authentication + JWT
    ├── users/                 # User management
    ├── drivers/               # Driver profiles + documents
    ├── owners/                # Owner profiles
    ├── companies/             # Companies + members
    ├── vehicles/              # Vehicle management
    ├── contracts/             # Contract engine
    ├── payments/              # Payment engine + ledger
    ├── settlements/           # Settlement processing
    ├── fleet/                 # Fleet management
    ├── maintenance/           # Maintenance system
    ├── disputes/              # Dispute management
    ├── legal/                 # Legal cases
    ├── notifications/         # Notification system
    ├── documents/             # Document management
    ├── reports/               # Reporting
    └── audit/                 # Audit logging
```

## Security Architecture

- JWT authentication (access + refresh tokens)
- RBAC enforced server-side at every endpoint
- Resource-level authorization (prevents IDOR/BOLA)
- Input validation via class-validator
- Rate limiting via NestJS Throttler
- Helmet HTTP security headers
- CORS controlled per environment
- Passwords hashed with bcrypt (salt rounds: 12)
- Financial operations require authentication + authorization
- Payment idempotency keys prevent duplicate transactions

## Development Principles

1. **Backend first** — implement backend before connecting UI
2. **Tests before deployment** — write tests alongside features
3. **Audit everything financial** — all money movement has audit records
4. **No duplicate business logic** — clients call the API; they do not compute
5. **Ownership transfer is explicit** — never automatic on balance = 0
