# Local Development Guide

Complete guide for setting up and running Taskinfa Kanban locally.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Database Management](#database-management)
6. [Testing](#testing)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org)
- **npm 9+** - Comes with Node.js

### Optional (for full orchestrator functionality)

- **Claude CLI** - [Download from claude.ai/download](https://claude.ai/download)
  - Required if you want to run the orchestrator locally
- **GitHub CLI (`gh`)** - [Install from cli.github.com](https://cli.github.com/)
  - Required for PR creation workflows

### Verification

Check your installations:

```bash
node -v    # Should be v18.0.0 or higher
npm -v     # Should be v9.0.0 or higher
claude -v  # Optional: Claude CLI version
gh --version  # Optional: GitHub CLI version
```

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/secanltd/taskinfa-kanban.git
cd taskinfa-kanban
```

### 2. One-Command Setup

```bash
./dev.sh
```

That's it! The `dev.sh` script will:

- ✅ Check prerequisites (Node.js version, npm)
- ✅ Install dependencies if needed
- ✅ Create `.dev.vars` with safe defaults
- ✅ Handle port conflicts intelligently
- ✅ Start the Next.js development server
- ✅ Run health checks
- ✅ Display dashboard URL

**Output:**

```
╔════════════════════════════════════════╗
║        Development server ready!       ║
╚════════════════════════════════════════╝

Dashboard:   http://localhost:3000
Logs:        tail -f /path/to/.dev-dashboard.log

Press Ctrl+C to stop all services
```

### 3. Access the Dashboard

Open your browser to **http://localhost:3000**

### 4. Create an Account

1. Click **Sign Up**
2. Create your account
3. Start creating projects and tasks!

---

## Project Structure

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/              # Next.js app + REST API
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router pages
│   │   │   ├── components/    # React components
│   │   │   └── lib/           # Utilities, database, auth
│   │   ├── migrations/        # D1 database migrations
│   │   ├── wrangler.toml      # Cloudflare Workers config
│   │   └── .dev.vars          # Local environment variables (gitignored)
│   ├── telegram/              # Telegram bot Worker
│   └── shared/                # Shared TypeScript types
├── scripts/
│   ├── orchestrator.ts        # Orchestrator daemon (source)
│   ├── build-orchestrator.js  # Bundler for orchestrator
│   └── install.sh             # Installer script
├── .github/workflows/         # CI/CD pipelines
├── dev.sh                     # Local development script ⭐
├── .env.example               # Environment variables template
├── CLAUDE.md                  # Project rules for Claude Code
└── README.md                  # Main documentation
```

---

## Development Workflow

### Starting Development

```bash
./dev.sh
```

### Stopping Services

Press **Ctrl+C** in the terminal where `dev.sh` is running.

Or manually:

```bash
pkill -f 'next dev'
```

### Running on a Different Port

If port 3000 is in use, `dev.sh` automatically finds the next available port:

```bash
./dev.sh
# Output: Using alternative port: 3001
# Dashboard: http://localhost:3001
```

### Manual Start (without dev.sh)

If you prefer to run manually:

```bash
# Install dependencies
npm install

# Start dashboard
npm run dashboard:dev

# Dashboard will be at http://localhost:3000
```

---

## Database Management

Taskinfa uses **Cloudflare D1** (SQLite) for the database.

### Local Database

Local development uses a local D1 database (SQLite file).

**Location:** `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/...`

### Viewing Database Schema

```bash
cd packages/dashboard
wrangler d1 execute taskinfa-kanban-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Creating a New Migration

```bash
cd packages/dashboard

# Create migration file
wrangler d1 migrations create taskinfa-kanban-db <migration-name>

# Example:
wrangler d1 migrations create taskinfa-kanban-db add_task_tags
```

This creates a new file in `packages/dashboard/migrations/` with a timestamp prefix.

### Applying Migrations

**Local (Development):**

```bash
cd packages/dashboard
wrangler d1 migrations apply taskinfa-kanban-db --local
```

**Test Environment:**

```bash
cd packages/dashboard
wrangler d1 migrations apply taskinfa-kanban-test-db --remote
```

**Production:**

⚠️ **DO NOT run migrations manually in production!** Use the CI/CD workflow instead:

```bash
# Tag for test migration
git tag migratedb/test/v2.3.0
git push origin migratedb/test/v2.3.0

# After testing, tag for production migration
git tag migratedb/prod/v2.3.0
git push origin migratedb/prod/v2.3.0
```

### Migration Best Practices

1. **Always test locally first:**
   ```bash
   wrangler d1 migrations apply taskinfa-kanban-db --local
   ```

2. **Then apply to test environment:**
   ```bash
   git tag migratedb/test/v2.3.0
   git push origin migratedb/test/v2.3.0
   ```

3. **Only after testing, apply to production:**
   ```bash
   git tag migratedb/prod/v2.3.0
   git push origin migratedb/prod/v2.3.0
   ```

4. **Never delete migration files** - migrations are tracked and applied in order

5. **Document schema changes** - add comments to migration files

---

## Testing

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode (for TDD)
npm run test:watch

# Test specific file
npm test -- src/lib/auth.test.ts
```

### E2E Tests (Playwright)

E2E tests require the application to be running.

**Terminal 1 - Start server:**

```bash
./dev.sh
```

**Terminal 2 - Run E2E tests:**

```bash
npx playwright test

# With UI mode
npx playwright test --ui

# Specific test file
npx playwright test tests/e2e/login.spec.ts
```

### Linting

```bash
# Lint all packages
npm run lint

# Lint specific package
npm run lint --workspace=packages/dashboard
```

---

## Common Tasks

### Building for Production

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=packages/dashboard
```

### Running the Orchestrator Locally

The orchestrator polls your dashboard for tasks and spawns Claude sessions.

**Prerequisites:**
- Claude CLI installed
- Dashboard running (locally or hosted)
- API key from dashboard (Settings > API Keys)

**Setup:**

1. Create `.env` file in project root:

```bash
cp .env.example .env
```

2. Edit `.env` and fill in:

```bash
TASKINFA_API_KEY=tk_your_api_key_here
TASKINFA_API_URL=http://localhost:3000/api
ANTHROPIC_API_KEY=sk-ant-your-key-here
POLL_INTERVAL=30
```

3. Run orchestrator:

```bash
npm run orchestrator
```

### Viewing Logs

**Dashboard logs (during development):**

```bash
tail -f .dev-dashboard.log
```

**Orchestrator logs:**

```bash
# Logs are written to stdout when running with npm run orchestrator
# For production, check ~/.taskinfa-kanban/logs/orchestrator.log
```

### Clearing Local Database

```bash
cd packages/dashboard
rm -rf .wrangler/state/v3/d1/
wrangler d1 migrations apply taskinfa-kanban-db --local
```

This removes the local database and re-applies all migrations.

---

## Troubleshooting

### Port Already in Use

**Problem:** `./dev.sh` shows port conflict but doesn't resolve it

**Solution:**

1. Check what's using the port:
   ```bash
   lsof -i :3000
   ```

2. Kill the process:
   ```bash
   pkill -f 'next dev'
   ```

3. Or let `dev.sh` handle it automatically (it finds the next available port)

### Dependencies Out of Sync

**Problem:** Errors about missing packages or version mismatches

**Solution:**

```bash
# Clean install
rm -rf node_modules
npm install

# Or use the clean script
npm run clean
npm install
```

### `.dev.vars` Missing

**Problem:** Authentication errors in local development

**Solution:**

`dev.sh` automatically creates `.dev.vars` if missing. If you need to recreate it:

```bash
rm packages/dashboard/.dev.vars
./dev.sh  # Will auto-generate
```

Or manually create `packages/dashboard/.dev.vars`:

```bash
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ENVIRONMENT=development
```

### Database Migration Errors

**Problem:** Migration fails with "table already exists"

**Cause:** Migrations are tracked in `d1_migrations` table. If you manually ran migrations before, D1 might not know about them.

**Solution:**

```bash
cd packages/dashboard

# Check which migrations D1 thinks are applied
wrangler d1 migrations list taskinfa-kanban-db --local

# If list is empty but tables exist, reset local DB
rm -rf .wrangler/state/v3/d1/
wrangler d1 migrations apply taskinfa-kanban-db --local
```

### Build Errors

**Problem:** TypeScript or build errors

**Solution:**

```bash
# Clean build artifacts
npm run clean

# Reinstall dependencies
npm install

# Build shared package first (other packages depend on it)
npm run build --workspace=packages/shared

# Then build dashboard
npm run build --workspace=packages/dashboard
```

### Claude CLI Not Found

**Problem:** Orchestrator can't find `claude` command

**Solution:**

1. Install Claude CLI: https://claude.ai/download
2. Verify installation:
   ```bash
   claude -v
   ```
3. Add to PATH if needed (check installer instructions)

### GitHub CLI Not Authenticated

**Problem:** PR creation fails with auth error

**Solution:**

```bash
gh auth login
# Follow prompts to authenticate
```

---

## Next Steps

- **Read [CLAUDE.md](CLAUDE.md)** for project-specific conventions
- **Read [DEV_SCRIPT_GUIDE.md](DEV_SCRIPT_GUIDE.md)** for details on intelligent port management
- **See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for system design overview
- **Check [docs/API_REFERENCE.md](docs/API_REFERENCE.md)** for API endpoints

---

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/secanltd/taskinfa-kanban/issues)
- **Discussions:** [GitHub Discussions](https://github.com/secanltd/taskinfa-kanban/discussions)
- **Documentation:** [README.md](README.md)

---

**Happy coding! 🚀**
