# Local Development Setup

Complete guide to get Taskinfa Kanban running locally for development.

## Prerequisites

- **Node.js 18+** (`node --version`)
- **npm 9+** (`npm --version`)
- **Git**
- **Wrangler CLI** (`npm install -g wrangler`) — for local D1 database

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/secanltd/taskinfa-kanban.git
cd taskinfa-kanban
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for all packages (dashboard, telegram, shared).

### 3. Build Packages

```bash
npm run build
```

### 4. Set Up Local Database

```bash
cd packages/dashboard

# Apply all migrations
for f in migrations/*.sql; do
  npx wrangler d1 execute taskinfa-kanban-db --local --file="$f"
done
```

### 5. Set Secrets

The dashboard needs `JWT_SECRET` for authentication. For local development, Wrangler reads from `.dev.vars`:

```bash
# In packages/dashboard/
echo "JWT_SECRET=$(openssl rand -hex 32)" > .dev.vars
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

1. Go to **Settings** > **API Keys**
2. Click **Generate API Key**
3. Save the key (shown only once) — you'll need it for the orchestrator

## Running the Orchestrator (Dev Mode)

For development, you can run the orchestrator directly from the repo without installing:

```bash
# Create a .env file with your settings
cat > .env << 'EOF'
KANBAN_API_URL=http://localhost:3000
KANBAN_API_KEY=tk_your_api_key_here
PROJECTS_DIR=/path/to/your/projects
POLL_INTERVAL=60000
MAX_CONCURRENT=1
EOF

# Run directly with tsx
npx tsx --env-file=.env scripts/orchestrator.ts
```

Or build and run the bundled version:

```bash
npm run build:orchestrator    # outputs dist/orchestrator.js
TASKINFA_CONFIG=.env node dist/orchestrator.js
```

## Running the Telegram Bot

```bash
npm run telegram:dev
```

The bot runs as a separate Cloudflare Worker that shares the D1 database with the dashboard. See the Telegram Bot section in the [README](../README.md#telegram-bot) for setup.

## Project Structure

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/         # Next.js 15 app (CF Workers)
│   ├── telegram/          # Telegram bot (CF Worker)
│   └── shared/            # Shared TypeScript types
├── scripts/
│   ├── orchestrator.ts    # Orchestrator daemon source
│   ├── build-orchestrator.js  # esbuild bundler
│   └── install.sh         # Interactive installer
├── .github/workflows/     # CI/CD pipelines
├── docs/                  # Documentation
└── dist/                  # Build output (gitignored)
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run lint` | Run linter across all packages |
| `npm run dashboard:dev` | Start dashboard in dev mode |
| `npm run telegram:dev` | Start Telegram bot locally |
| `npm run build:orchestrator` | Bundle orchestrator to `dist/orchestrator.js` |

## Verification

### Test Dashboard

1. Open http://localhost:3000
2. You should see the login page
3. Sign up, log in, and try creating a task

### Test API

```bash
curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Should return a JSON list of tasks.

## Troubleshooting

### Database errors

```bash
# Check if local database exists
ls packages/dashboard/.wrangler/state/v3/d1/

# Recreate: delete and re-apply migrations
rm -rf packages/dashboard/.wrangler/state/v3/d1/
cd packages/dashboard
for f in migrations/*.sql; do
  npx wrangler d1 execute taskinfa-kanban-db --local --file="$f"
done
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

- [Deploy to Cloudflare](DEPLOYMENT.md) — deploy the dashboard to production
- [Set up the Orchestrator](WORKER_SETUP.md) — install and run the orchestrator daemon
- [API Reference](API_REFERENCE.md) — full REST API documentation
- [Environment Variables](ENVIRONMENT.md) — all configuration options
