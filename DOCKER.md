# Docker-Based Bot Setup

## Overview

Taskinfa-Bot now supports Docker containerization for isolated, secure bot execution with multi-bot support and task commenting system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User Machine                                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Docker Container: "Bot-John"                       │    │
│  │  ├─ Node.js 20                                      │    │
│  │  ├─ Claude Code CLI                                 │    │
│  │  ├─ Taskinfa Bot                                    │    │
│  │  ├─ Firewall (restricted network)                   │    │
│  │  └─ Working Directory (/workspace)                  │    │
│  └────────────────────────────────────────────────────┘    │
│            │ MCP (stdio) + Network                          │
│            ▼                                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Docker Container: "Bot-Gordon" (optional)          │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ HTTPS
                    ▼
        ┌───────────────────────┐
        │  Cloudflare Dashboard │
        │  ├─ D1 Database       │
        │  ├─ Tasks + Comments  │
        │  └─ Kanban UI         │
        └───────────────────────┘
```

## Features Implemented

### Phase 1: Database & Schema ✅

- **Migration File**: `packages/dashboard/migrations/002_add_comments.sql`
  - Added `assigned_to` column to `tasks` table
  - Created `task_comments` table with indexes
  - Supports comment types: progress, question, summary, error

- **Type Updates**: `packages/shared/src/types/index.ts`
  - Added `TaskComment` interface
  - Added `CommentType` and `AuthorType` types
  - Updated request/response types for comments and claiming

### Phase 2: MCP Server Enhancements ✅

- **New MCP Tools**: `packages/dashboard/src/lib/mcp/server.ts`
  - `add_task_comment` - Add progress, error, or summary comments
  - `list_task_comments` - Retrieve comments for a task
  - `claim_task` - Atomically assign a bot to a task

- **Updated Tools**:
  - `list_tasks` - Now supports `assigned_to` filter
  - `update_task_status` - Now supports `assigned_to` field

### Phase 3: Bot Updates ✅

- **MCP Client**: `packages/bot/src/client/mcp-client.ts`
  - Added `addComment()` method
  - Added `listComments()` method
  - Added `claimTask()` method

- **Task Executor**: `packages/bot/src/loop/executor.ts`
  - Added `botName` to ExecutorConfig
  - Implemented atomic task claiming
  - Added comment logging throughout execution:
    - Initial claim comment
    - Loop progress comments (every 5 loops)
    - File change comments
    - Error comments
    - Completion summary comments

- **Bot CLI**: `packages/bot/src/index.ts`
  - Added `--name` option for bot name (default: "Bot-John")

### Phase 4: Docker Container Setup ✅

- **Dockerfile**: `packages/bot/Dockerfile`
  - Based on Node.js 20
  - Includes Claude Code CLI
  - Non-root user execution
  - Firewall script integration

- **Docker Compose**: `docker-compose.yml`
  - Primary bot: `bot-john`
  - Optional multi-bot support: `bot-gordon`, `bot-smith`
  - Network isolation
  - Volume mounts for workspace and Claude config

- **Firewall Script**: `scripts/bot-firewall.sh`
  - Restricts network access to whitelisted domains
  - Allows Claude API, NPM, GitHub

- **Helper Scripts**:
  - `scripts/start-bot.sh` - Start a bot container
  - `scripts/stop-bot.sh` - Stop a bot container
  - `scripts/logs.sh` - View bot logs

## Quick Start

### Prerequisites

- Docker installed
- Docker Compose installed
- Claude API key

### Setup

1. **Clone and build the project:**
   ```bash
   npm install
   npm run build
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your CLAUDE_API_KEY and DASHBOARD_URL
   ```

3. **Run database migration:**
   ```bash
   # Apply the migration to your D1 database
   # (Instructions depend on your Cloudflare setup)
   ```

4. **Build Docker image:**
   ```bash
   docker-compose build
   ```

5. **Start the bot:**
   ```bash
   ./scripts/start-bot.sh john
   ```

6. **View logs:**
   ```bash
   ./scripts/logs.sh john
   ```

## Multi-Bot Setup

To run multiple bots in parallel:

1. **Start additional bots:**
   ```bash
   ./scripts/start-bot.sh gordon
   ./scripts/start-bot.sh smith
   ```

2. **View all running bots:**
   ```bash
   docker-compose ps
   ```

3. **Stop all bots:**
   ```bash
   ./scripts/stop-bot.sh all
   ```

## Bot Workflow

1. **Initialize**: Bot starts with assigned name (e.g., "Bot-John")
2. **Fetch Task**: Query MCP server for unassigned tasks
3. **Claim Task**: Atomically assign bot to task
4. **Execute Loop**:
   - Add progress comments
   - Run Claude Code
   - Log file changes
   - Log errors if encountered
5. **Complete**: Add final summary comment and mark task as "review"

## Task Comments System

Bots automatically add comments during execution:

- **Progress**: "Starting loop 5", "Modified 2 files: index.ts, utils.ts"
- **Error**: "Encountered 1 error(s): TypeScript compilation failed"
- **Summary**: "Task completed successfully! Total loops: 8, Files changed: 5"
- **Question**: (Future: bots can ask humans for help)

## Environment Variables

Required:
- `CLAUDE_API_KEY` - Your Claude API key
- `DASHBOARD_URL` - URL of your Taskinfa dashboard
- `WORKSPACE_ID` - Workspace ID (default: "default")

Optional:
- `BOT_NAME` - Bot name (default: "Bot-John")

## Security

- **Container Isolation**: Bots run in isolated containers
- **Network Restriction**: Firewall limits access to whitelisted domains
- **No Host Access**: Containers can't access host file system (except workspace)
- **Read-Only Config**: Claude config mounted read-only

## What's Next (Not Yet Implemented)

### Phase 5: Installation Script
- One-liner installation script
- Docker dependency checks
- Interactive configuration wizard

### Phase 6: Dashboard UI Updates
- Task detail view with comments timeline
- Bot avatar/name display
- Comment type styling (colors/icons)

### Phase 7: Documentation
- Complete README update
- Setup guide
- Multi-bot deployment guide
- Troubleshooting section

## Current Limitations

1. **No Automated Migration**: You must manually run the database migration
2. **No UI for Comments**: Comments are stored but not yet visible in dashboard
3. **No Installation Script**: Manual Docker setup required
4. **Firewall Placeholder**: Current firewall script is simplified

## Troubleshooting

### Bot won't start
- Check Docker logs: `docker-compose logs bot-john`
- Verify environment variables in `.env`
- Ensure CLAUDE_API_KEY is valid

### Bot can't connect to MCP server
- Verify DASHBOARD_URL is correct
- Check network connectivity
- Review firewall rules

### Multiple bots claiming same task
- This shouldn't happen due to atomic claiming
- If it does, check database transaction support
- Review `claim_task` MCP tool logs

## Development

### Local Testing

```bash
# Run bot locally (without Docker)
npm run build
npm run bot:run -- --name Bot-Test
```

### Build Docker Image

```bash
docker-compose build bot-john
```

### Run Single Bot

```bash
docker-compose up bot-john
```

## License

MIT
