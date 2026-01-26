# Taskinfa-Bot

Autonomous task automation system that integrates a kanban board dashboard with Claude Code. The bot fetches tasks from the dashboard, executes them using Claude Code in a loop, and updates task status automatically.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- **Kanban Dashboard**: Beautiful Next.js 15 dashboard with 5-column kanban board
- **Autonomous Execution**: Bot automatically fetches and executes tasks using Claude Code
- **MCP Integration**: Native Claude Code integration via Model Context Protocol
- **REST API Fallback**: RESTful API for debugging and external tools
- **Circuit Breaker**: Intelligent loop detection and error handling
- **Cloudflare D1**: SQLite-compatible database with zero-config deployment
- **Multi-Workspace**: Support for multiple isolated workspaces
- **API Key Auth**: JWT-based authentication for secure access

## Architecture

```
Dashboard (Next.js + D1) ←→ [MCP/REST] ←→ Bot (Node.js) → Claude Code CLI
```

**Dual Protocol:**
- **Primary**: MCP (Model Context Protocol) for native Claude Code integration
- **Fallback**: REST API for debugging and external tools

**Task Status Flow:**
```
backlog → todo → in_progress → review → done
```

## Project Structure

```
taskinfa-bot/
├── packages/
│   ├── dashboard/          # Next.js dashboard + MCP server
│   │   ├── src/
│   │   │   ├── app/       # Pages + API routes
│   │   │   ├── components/# Kanban UI
│   │   │   └── lib/
│   │   │       ├── db/    # D1 client
│   │   │       ├── auth/  # JWT validation
│   │   │       └── mcp/   # MCP server
│   │   └── schema.sql     # D1 database schema
│   │
│   ├── bot/               # Task executor
│   │   └── src/
│   │       ├── loop/      # Main execution loop
│   │       ├── client/    # MCP client
│   │       └── claude/    # Claude Code wrapper
│   │
│   └── shared/            # Shared TypeScript types
│
└── turbo.json             # Turborepo config
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- [Claude Code CLI](https://claude.com/claude-code) installed and configured
- Cloudflare account (for deployment)

### Installation

```bash
# Clone repository
git clone https://github.com/secanltd/taskinfa-kanban.git
cd taskinfa-kanban

# Install dependencies
npm install

# Build all packages
npm run build
```

### Setup Database

```bash
# Create D1 database
cd packages/dashboard
npx wrangler d1 create taskinfa-db

# Update wrangler.toml with database ID
# Then run migration
npm run db:migrate
```

### Start Dashboard

```bash
# Development mode
npm run dashboard:dev

# Open browser at http://localhost:3000
```

### Run Bot

```bash
# Run bot for default workspace
npm run bot:run

# Or with custom options
cd packages/bot
npm start -- run --workspace=default --dir=/path/to/project
```

## Usage

### Creating Tasks

**Via Dashboard UI:**
1. Open dashboard at `http://localhost:3000`
2. Click "Add Task" button
3. Fill in title, description, priority, and labels
4. Task appears in "To Do" column

**Via API:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add console.log to index.ts",
    "description": "Add debug logging to the main function",
    "priority": "medium",
    "labels": ["enhancement"]
  }'
```

### Generating API Keys

API keys are required for bot authentication. Generate them via:

```bash
# TODO: Add API key generation script
# For now, manually insert into D1:
wrangler d1 execute taskinfa-db --local --command \
  "INSERT INTO api_keys (id, workspace_id, key_hash, name) VALUES ('key_1', 'default', 'hash', 'Bot Key')"
```

### Bot Execution Loop

The bot follows this workflow:

1. **Fetch**: Query MCP server for next task in "todo" status
2. **Start**: Update status to "in_progress"
3. **Execute**: Run Claude Code with task description
   - Use `--continue` flag for session continuity
   - Parse output for completion signals
   - Track files changed and errors
4. **Circuit Breaker**: Stop after:
   - 3+ loops without progress
   - 5+ loops with repeated errors
   - Max 50 loops total
5. **Complete**: Update status to "review" with completion notes

### Exit Detection (Ralph-Style)

The bot uses dual-condition exit detection:

1. **Completion Indicators**: Count phrases like "task complete", "successfully completed", etc.
2. **Exit Signal**: Look for explicit `RALPH_STATUS: {"EXIT_SIGNAL": true}` in output

**Exit Condition**: ≥2 completion indicators AND explicit EXIT_SIGNAL

### MCP Server Tools

Available to Claude Code sessions:

- `list_tasks`: Get tasks filtered by workspace/status/priority
- `get_task`: Fetch task details by ID
- `update_task_status`: Change status and add completion notes

## Configuration

### Environment Variables

Create `.env` files in each package:

**Dashboard (.env.local):**
```env
JWT_SECRET=your-secret-key-change-in-production
```

**Bot (.env):**
```env
TASKINFA_API_KEY=tk_your_api_key
TASKINFA_WORKSPACE=default
```

### Bot CLI Options

```bash
taskinfa-bot run [options]

Options:
  -w, --workspace <id>      Workspace ID (default: "default")
  -d, --dir <path>          Working directory (default: current)
  -s, --server <command>    MCP server command (default: "node")
  -a, --args <args>         MCP server arguments
  -m, --max-loops <number>  Max loops per task (default: 50)
  -c, --circuit-breaker <n> Error threshold (default: 5)
  -n, --no-progress <n>     No progress threshold (default: 3)
```

## Deployment

### Dashboard (Cloudflare Pages)

```bash
cd packages/dashboard

# Deploy database
npm run db:migrate:prod

# Deploy to Pages
npm run deploy
```

### Bot (Run Locally or Cloud)

The bot is designed to run as a one-shot process per task. Run it via:

- **Local**: `npm run bot:run`
- **Cron Job**: Schedule via `crontab` or systemd timer
- **Cloud Function**: Deploy as AWS Lambda or Cloudflare Worker

## Development

### Running Tests

```bash
# Run all tests
npm test

# Test individual package
npm test --workspace=packages/bot
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=packages/dashboard
```

### Linting

```bash
# Lint all packages
npm run lint
```

## API Reference

### REST API Endpoints

**Tasks:**
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

**Authentication:**
All API requests require `Authorization: Bearer <api_key>` header.

### MCP Tools

See [MCP Server Documentation](packages/dashboard/src/lib/mcp/README.md) for full tool specifications.

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [ralph-claude-code](https://github.com/frankbria/ralph-claude-code) - Loop architecture inspiration
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Claude Code](https://claude.com/claude-code) - AI-powered development assistant

## Support

- **Issues**: [GitHub Issues](https://github.com/secanltd/taskinfa-kanban/issues)
- **Discussions**: [GitHub Discussions](https://github.com/secanltd/taskinfa-kanban/discussions)

---

Developed by **SECAN** • [GitHub](https://github.com/secanltd)
