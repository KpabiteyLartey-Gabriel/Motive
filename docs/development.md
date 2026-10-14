# GH Motive — Development Guide

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 6

## Initial Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd gh-motive
npm install
```

### 2. Configure the backend environment

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your local database credentials
```

Minimum required:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/gh_motive_dev?schema=public"
JWT_SECRET=any-long-random-string-for-development
JWT_REFRESH_SECRET=another-long-random-string
```

### 3. Configure the web environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

### 4. Configure the mobile environment

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

### 5. Set up the database

```bash
# Create the database in PostgreSQL first:
# CREATE DATABASE gh_motive_dev;

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data (creates admin user and roles)
npm run db:seed
```

## Running the Applications

### Run everything (backend + web)

```bash
npm run dev
```

### Run individually

```bash
# Backend only (port 3001)
npm run dev:backend

# Web only (port 3000)
npm run dev:web

# Mobile (via Expo)
npm run dev:mobile
```

### From individual app directories

```bash
# Backend
cd apps/backend
npm run dev

# Web
cd apps/web
npm run dev

# Mobile
cd apps/mobile
npm start
```

## API Endpoints

Once running, the backend exposes:
- API: `http://localhost:3001/api/v1`
- Swagger docs: `http://localhost:3001/api/docs`
- Health check: `http://localhost:3001/api/v1/health`

## Default Credentials (Development Only)

After seeding:
- Email: `admin@ghmotive.com`
- Password: `Admin@GHMotive2024!`
- Role: `SUPER_ADMIN`

**Change this immediately when deploying to any shared environment.**

## Database Commands

```bash
npm run db:generate      # Generate Prisma client after schema changes
npm run db:migrate       # Run pending migrations (dev)
npm run db:seed          # Seed development data
npm run db:studio        # Open Prisma Studio GUI
npm run db:reset         # Reset database (WARNING: deletes all data)
```

## Testing

```bash
# Run all tests
npm run test

# Backend tests only
npm run test:backend

# With coverage
cd apps/backend && npm run test:cov
```

## Common Issues

### "Can't reach database server"
Ensure PostgreSQL is running and the DATABASE_URL in `apps/backend/.env` is correct.

### "Prisma Client not generated"
Run `npm run db:generate` from the root.

### Port conflicts
- Backend default: 3001
- Web default: 3000
- Change via PORT env var (backend) or next dev -p (web)
