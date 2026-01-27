# Taskinfa Bot - Quick Start Guide

## 🎯 Overview

You've created an API key at **https://taskinfa-kanban.secan-ltd.workers.dev/dashboard**. Now let's get the bot running!

## 📋 Prerequisites

- [x] API key created from dashboard ✅
- [ ] `.env` file configured with your keys
- [ ] Claude API key from https://console.anthropic.com/
- [ ] Docker installed (for container deployment)

## 🚀 Quick Setup (3 Steps)

### Step 1: Configure Environment

Edit the `.env` file that was created and replace the placeholder values:

```bash
# Edit .env file
nano .env

# Or use VS Code
code .env
```

**Required values:**
1. `TASKINFA_API_KEY` - The API key you just created from the dashboard
2. `CLAUDE_API_KEY` - Your Claude API key from Anthropic Console

### Step 2: Choose Your Deployment Method

You have 3 options to run the bot:

#### Option A: Local Development (Fastest for testing)

```bash
# Run the bot directly on your machine
npm run bot:run

# Or with custom options
cd packages/bot
npm start -- run --workspace=default --dir=/path/to/your/project
```

#### Option B: Docker Container (Production-like)

```bash
# Build and run with docker-compose
docker-compose up bot-john

# View logs
docker-compose logs -f bot-john

# Stop container
docker-compose down
```

#### Option C: DevContainer (Best for development)

1. Open VS Code
2. Install "Remote - Containers" extension
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
4. Select "Remote-Containers: Reopen in Container"
5. Wait for container to build
6. Run bot inside container: `npm run bot:run`

### Step 3: Create a Test Task

**Via Dashboard UI:**
1. Go to https://taskinfa-kanban.secan-ltd.workers.dev/dashboard
2. Click "Add Task" button
3. Fill in:
   - **Title**: "Add console.log to test.ts"
   - **Description**: "Create a file called test.ts and add a simple console.log statement"
   - **Priority**: Medium
4. Move task to "To Do" column

**Via API (using curl):**
```bash
curl -X POST https://taskinfa-kanban.secan-ltd.workers.dev/api/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add console.log to test.ts",
    "description": "Create a file called test.ts and add a simple console.log statement",
    "priority": "medium",
    "workspace_id": "default"
  }'
```

## 📊 How It Works

```
┌─────────────────────────────────────────────────────────┐
│  1. Bot fetches next task from "To Do" (via MCP/API)   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. Bot updates task status to "In Progress"           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Claude Code executes the task                       │
│     - Reads files                                       │
│     - Makes changes                                     │
│     - Runs commands                                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. Circuit Breaker monitors progress                   │
│     - Max 50 loops                                      │
│     - Stops if no progress (3 loops)                    │
│     - Stops on repeated errors (5 times)                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. Task completed and moved to "Review"                │
└─────────────────────────────────────────────────────────┘
```

## 🎛️ Configuration Options

### Environment Variables

```env
# Dashboard Configuration
DASHBOARD_URL=https://taskinfa-kanban.secan-ltd.workers.dev
WORKSPACE_ID=default

# Authentication
TASKINFA_API_KEY=tk_xxxxxxxxxxxxx       # From dashboard
CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxx     # From Anthropic

# Bot Configuration
BOT_NAME=Bot-John                        # Friendly name for logs
TASKINFA_MCP_SERVER=node                 # MCP server command
TASKINFA_MCP_ARGS=packages/dashboard/dist/lib/mcp/server.js
```

### CLI Options

```bash
taskinfa-bot run [options]

Options:
  -w, --workspace <id>       Workspace ID (default: "default")
  --name <name>              Bot name (default: "Bot-John")
  -d, --dir <path>           Working directory (default: current)
  -s, --server <command>     MCP server command (default: "node")
  -a, --args <args>          MCP server arguments
  -m, --max-loops <number>   Max loops per task (default: 50)
  -c, --circuit-breaker <n>  Error threshold (default: 5)
  -n, --no-progress <n>      No progress threshold (default: 3)
```

**Example with custom options:**
```bash
npm start -- run \
  --workspace=my-workspace \
  --name=Bot-Alice \
  --dir=/Users/me/my-project \
  --max-loops=30
```

## 🐳 Docker Commands Reference

### Single Bot
```bash
# Start bot (runs continuously)
docker-compose up bot-john

# Start in background
docker-compose up -d bot-john

# View logs
docker-compose logs -f bot-john

# Stop bot
docker-compose down

# Rebuild after code changes
docker-compose build bot-john
docker-compose up -d bot-john
```

### Multiple Bots (Advanced)
```bash
# Start all bots (John, Gordon, Smith)
docker-compose --profile multi-bot up -d

# View all logs
docker-compose --profile multi-bot logs -f

# Stop all bots
docker-compose --profile multi-bot down
```

### Bot Workspace Isolation

Each bot has its own workspace directory:
- `workspace-john/` - Bot-John's working directory
- `workspace-gordon/` - Bot-Gordon's working directory
- `workspace-smith/` - Bot-Smith's working directory

This keeps file changes isolated between bots.

## 🔧 Troubleshooting

### Bot can't authenticate with dashboard

**Problem:** `401 Unauthorized` error

**Solution:**
1. Check `.env` file has correct `TASKINFA_API_KEY`
2. Verify API key exists in dashboard (Settings → API Keys)
3. Test API key manually:
   ```bash
   curl https://taskinfa-kanban.secan-ltd.workers.dev/api/tasks \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Claude Code not found

**Problem:** `claude: command not found`

**Solution:**
```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### MCP Server can't connect

**Problem:** Bot can't connect to MCP server

**Solution:**
```bash
# Verify MCP server file exists
ls -la packages/dashboard/dist/lib/mcp/server.js

# If missing, rebuild:
npm run build

# Test MCP server manually
cd packages/dashboard
node dist/lib/mcp/server.js
# Should output: "Taskinfa MCP Server started on stdio"
```

### Docker container won't start

**Problem:** Container exits immediately

**Solution:**
```bash
# Check logs
docker-compose logs bot-john

# Rebuild container
docker-compose build bot-john

# Check environment variables
docker-compose config
```

## 📝 Next Steps

1. **Create more tasks** in the dashboard
2. **Monitor bot execution** via logs
3. **Review completed tasks** in "Review" column
4. **Set up multiple workspaces** for different projects
5. **Configure firewall** for production (see `DOCKER.md`)

## 🔗 Useful Links

- **Dashboard**: https://taskinfa-kanban.secan-ltd.workers.dev/dashboard
- **API Documentation**: See `README.md`
- **MCP Server**: See `packages/dashboard/src/lib/mcp/README.md`
- **Docker Guide**: See `DOCKER.md`
- **Full Setup**: See `SETUP.md`

## 💡 Tips

- Start with simple tasks to test the bot
- Use the "Review" column to verify bot work before moving to "Done"
- Check bot logs to understand what Claude Code is doing
- Use `--max-loops=10` for faster testing
- Monitor the dashboard to see real-time task status updates

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker-compose logs -f bot-john`
2. Review environment variables in `.env`
3. Test API key with curl command
4. Verify Claude Code installation
5. Check `TROUBLESHOOTING.md` for common issues

---

**Happy automating!** 🎉

The bot will continuously check for new tasks and execute them automatically.
