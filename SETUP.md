# Taskinfa-Bot Setup Guide

Complete step-by-step guide to get Taskinfa-Bot running on your machine.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and **npm 9+** installed
- **Claude Code CLI** installed (`npm install -g @anthropic-ai/claude-code`)
- **Cloudflare account** (for production deployment)
- **Git** installed

Verify installations:
```bash
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
claude --version # Should show Claude Code version
```

## Installation Steps

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/secanltd/taskinfa-kanban.git
cd taskinfa-kanban

# Install dependencies for all packages
npm install

# This installs dependencies for:
# - Root workspace
# - packages/dashboard
# - packages/bot
# - packages/shared
```

### 2. Build Shared Package

```bash
# Build shared types first (other packages depend on it)
npm run build --workspace=packages/shared
```

### 3. Setup Database

#### Local Development (SQLite)

```bash
cd packages/dashboard

# Create local D1 database
npx wrangler d1 create taskinfa-db

# Copy the database_id from output
# Update wrangler.toml with this ID

# Run database migration
npm run db:migrate

# Verify database
npx wrangler d1 execute taskinfa-db --local --command "SELECT * FROM workspaces"
```

#### Production (Cloudflare D1)

```bash
# Create production database
npx wrangler d1 create taskinfa-db

# Update wrangler.toml [env.production] section with database_id

# Run production migration
npm run db:migrate:prod
```

### 4. Generate API Key

```bash
# For now, manually insert API key into database
# In the future, this will be automated via CLI

cd packages/dashboard

# Generate a random API key
echo "tk_$(openssl rand -hex 16)"

# Hash it (use Node.js for consistency)
node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_KEY')).then(h => console.log([...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')))"

# Insert into database
npx wrangler d1 execute taskinfa-db --local --command \
  "INSERT INTO api_keys (id, workspace_id, key_hash, name) VALUES ('api_key_1', 'default', 'YOUR_HASH', 'Bot Key')"
```

### 5. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set:
# - JWT_SECRET (generate with: openssl rand -hex 32)
# - TASKINFA_API_KEY (use the key you generated above)
```

### 6. Build Dashboard

```bash
cd packages/dashboard

# Build Next.js app
npm run build

# Build MCP server
cd src/lib/mcp
npx tsc server.ts --outDir ../../../../dist/mcp
```

### 7. Build Bot

```bash
cd packages/bot

# Build TypeScript
npm run build

# Verify binary
./dist/index.js --version
```

## Running the System

### Start Dashboard (Terminal 1)

```bash
cd packages/dashboard
npm run dev

# Dashboard available at: http://localhost:3000
```

### Start Bot (Terminal 2)

```bash
cd packages/bot

# Run with default settings
npm start -- run

# Or with custom options
npm start -- run \
  --workspace=default \
  --dir=/path/to/your/project \
  --max-loops=30
```

### Create Test Task (Terminal 3)

```bash
# Using curl
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add hello world console.log",
    "description": "Add a console.log statement to the index.ts file",
    "priority": "medium"
  }'

# Or create via dashboard UI
# Open http://localhost:3000 and click "Add Task"
```

## Verification

### Test 1: Dashboard Access

1. Open http://localhost:3000
2. You should see the Kanban board with 5 columns
3. Sample tasks should be visible in various columns

### Test 2: API Access

```bash
# List tasks
curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_API_KEY"

# Should return JSON with task list
```

### Test 3: MCP Server

```bash
# Test MCP server directly
cd packages/dashboard
node dist/lib/mcp/server.js

# Should output: "Taskinfa MCP Server started on stdio"
# Press Ctrl+C to exit
```

### Test 4: Bot Execution

1. Create a simple task via dashboard
2. Move it to "To Do" column
3. Run bot: `npm run bot:run`
4. Watch bot logs - it should:
   - Fetch the task
   - Move it to "In Progress"
   - Execute Claude Code
   - Complete and move to "Review"

## Troubleshooting

### Database Connection Errors

```bash
# Check if database exists
npx wrangler d1 list

# Check database_id in wrangler.toml matches actual ID

# Reset database
npm run db:migrate
```

### MCP Server Not Starting

```bash
# Check Node.js can run the server
cd packages/dashboard
node dist/lib/mcp/server.js

# If error about missing modules, rebuild:
npm run build
```

### Bot Can't Connect to MCP

```bash
# Verify MCP server path in bot config
# Check that server.js exists at specified path
ls -la packages/dashboard/dist/lib/mcp/server.js
```

### API Authentication Fails

```bash
# Verify API key is in database
npx wrangler d1 execute taskinfa-db --local --command \
  "SELECT * FROM api_keys"

# Check JWT_SECRET is set in .env
cat .env | grep JWT_SECRET
```

## Next Steps

- **Deploy to Cloudflare**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Configure Claude Code**: Set up custom prompts and preferences
- **Create Workflows**: Design task automation workflows for your projects
- **Extend Functionality**: Add custom MCP tools or API endpoints

## Support

If you encounter issues:

1. Check [README.md](README.md) for detailed documentation
2. Search [GitHub Issues](https://github.com/secanltd/taskinfa-kanban/issues)
3. Open a new issue with:
   - Steps to reproduce
   - Error messages
   - Environment details (OS, Node version, etc.)

## Quick Reference

```bash
# Start dashboard
npm run dashboard:dev

# Start bot
npm run bot:run

# Build all packages
npm run build

# Run database migration
cd packages/dashboard && npm run db:migrate

# Generate API key
echo "tk_$(openssl rand -hex 16)"

# View logs
# Dashboard: Check terminal where dashboard:dev is running
# Bot: Check terminal where bot:run is running
```

---

Happy automating! 🚀
