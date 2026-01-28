# Local Setup Guide

Complete guide to get Taskinfa Kanban running locally.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** (`node --version`)
- **npm 9+** (`npm --version`)
- **Docker** (optional, for workers)
- **Git**

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/taskinfa-kanban.git
cd taskinfa-kanban
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for all packages (dashboard, bot, shared).

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set required values:

```bash
# Generate a secure JWT secret
openssl rand -hex 32
```

Update `.env`:
```
JWT_SECRET=your-generated-secret
SESSION_SECRET=another-generated-secret
```

### 4. Build Packages

```bash
npm run build
```

### 5. Setup Local Database

```bash
cd packages/dashboard

# Create local D1 database
npx wrangler d1 execute taskinfa-kanban-db --local \
  --file=./migrations/001_initial_schema.sql
```

Apply additional migrations if needed:
```bash
npx wrangler d1 execute taskinfa-kanban-db --local \
  --file=./migrations/002_add_comments.sql

npx wrangler d1 execute taskinfa-kanban-db --local \
  --file=./migrations/003_add_users.sql

npx wrangler d1 execute taskinfa-kanban-db --local \
  --file=./migrations/004_add_task_lists_and_order.sql
```

### 6. Start Dashboard

```bash
npm run dashboard:dev
```

Open http://localhost:3000 in your browser.

### 7. Create Account

1. Click "Sign Up"
2. Create your account
3. Log in

### 8. Generate API Key

1. Go to Settings
2. Click "Generate API Key"
3. Save the key (shown only once)

## Verification

### Test Dashboard

1. Open http://localhost:3000
2. You should see the Kanban board
3. Try creating a task

### Test API

```bash
curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Should return a JSON list of tasks.

## Running Workers

See [WORKER_SETUP.md](WORKER_SETUP.md) for Docker worker setup.

Quick start without Docker:

```bash
# In a new terminal
cd packages/bot
npm run dev
```

## Project Structure

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/      # Next.js app
│   ├── bot/            # Task executor
│   └── shared/         # Shared types
├── scripts/            # Helper scripts
├── docs/               # Documentation
└── docker-compose.yml  # Docker configuration
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run dashboard:dev` | Start dashboard in dev mode |
| `npm run bot:run` | Run bot executor |
| `npm run lint` | Run linter |

## Environment Variables

See [ENVIRONMENT.md](ENVIRONMENT.md) for complete reference.

## Troubleshooting

### Database errors

```bash
# Check if database exists
ls .wrangler/state/v3/d1/

# Recreate database
rm -rf .wrangler/state/v3/d1/
npm run db:migrate
```

### Build errors

```bash
# Clean and rebuild
rm -rf node_modules packages/*/node_modules
npm install
npm run build
```

### Port already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

## Next Steps

- [Deploy to Cloudflare](DEPLOYMENT.md)
- [Set up Docker workers](WORKER_SETUP.md)
- [API Reference](API_REFERENCE.md)
