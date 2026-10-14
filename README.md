# GH Motive

> Vehicle Operations, Mobility, Contract, Payment and Fleet Management Platform for Ghana

---

## Overview

GH Motive is a production-oriented platform connecting vehicle owners, drivers, transport companies, fleet managers, maintenance companies and legal professionals in a unified, auditable system.

---

## Architecture

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
                REST API
                     │
                PostgreSQL
                     │
        ┌────────────┼────────────┐
        │            │            │
     Payments     Storage      Notifications
```

---

## Applications

| Application | Technology | Location |
|-------------|-----------|----------|
| Backend API | NestJS + PostgreSQL + Prisma | `apps/backend` |
| Web App | Next.js + React + Tailwind CSS | `apps/web` |
| Mobile App | Expo + React Native | `apps/mobile` |

---

## Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/api-client` | Shared HTTP client used by web and mobile |
| `packages/validation` | Shared Zod validation schemas |
| `packages/constants` | Shared enumerations and constants |
| `packages/shared` | Shared utilities, formatters, types |

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- PostgreSQL >= 14
- Redis >= 6

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd gh-motive

# Install all dependencies
npm install
```

### Environment Setup

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your database credentials

# Web
cp apps/web/.env.example apps/web/.env.local

# Mobile
cp apps/mobile/.env.example apps/mobile/.env
```

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### Running the Applications

```bash
# Run backend + web simultaneously
npm run dev

# Run individually
npm run dev:backend    # Backend on http://localhost:3001
npm run dev:web        # Web on http://localhost:3000
npm run dev:mobile     # Mobile via Expo

# Or from each app directory:
cd apps/backend && npm run dev
cd apps/web && npm run dev
cd apps/mobile && npm start
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture overview |
| [Database](docs/database.md) | Database schema and design |
| [API](docs/api.md) | API endpoints reference |
| [Authentication](docs/authentication.md) | Auth and RBAC |
| [Payments](docs/payments.md) | Payment architecture |
| [Contracts](docs/contracts.md) | Contract system |
| [Vehicles](docs/vehicles.md) | Vehicle management |
| [Fleet](docs/fleet.md) | Fleet management |
| [Maintenance](docs/maintenance.md) | Maintenance system |
| [Disputes](docs/disputes.md) | Disputes and legal |
| [Mobile](docs/mobile.md) | Mobile application guide |
| [Security](docs/security.md) | Security model |
| [Deployment](docs/deployment.md) | Deployment guide |
| [Development](docs/development.md) | Development guide |

---

## User Types

- **Driver** — Operates vehicles under Work & Pay, Rental, or Driving On contracts
- **Owner** — Vehicle owners managing their fleet and driver relationships
- **Transport Company** — Companies managing vehicles, drivers and operations
- **Fleet Management Company** — Manages vehicle fleets on behalf of owners
- **Vehicle Placement Company** — Sources and places drivers with vehicles
- **Maintenance Company** — Provides vehicle servicing and repair
- **Legal/Dispute Resolution** — Handles disputes and legal cases
- **Admin / Super Admin** — Platform administration

---

## Driver Operating Models

| Model | Description |
|-------|-------------|
| **Work & Pay** | Driver makes installment payments toward vehicle ownership |
| **Rental** | Driver receives salary or revenue share; vehicle remains owned |
| **Driving On** | Driver pays owner fixed daily/weekly amount; keeps remaining profit |

---

## License

Proprietary — GH Motive. All rights reserved.
