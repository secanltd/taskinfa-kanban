# Taskinfa Kanban

Autonomous task execution system powered by Claude Code. Create tasks on your Kanban board, and an orchestrator daemon picks them up, spawns Claude sessions, creates PRs, and reports back -- fully hands-off.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## How It Works

1. You create tasks on the dashboard (or via Telegram)
2. The **orchestrator** polls every 15 minutes, finds pending tasks
3. For each task, it spawns a **Claude Code** session in the project directory
4. Claude reads the task, writes code, commits, pushes, and creates a PR
5. The task moves to **review** -- you merge or send it back

```
Dashboard (Next.js)  <-->  D1 Database  <-->  Orchestrator (Node.js daemon)
        ^                       ^                      |
        |                       |              spawns Claude Code
   Browser / API          Telegram Bot          sessions per task
```

## Quick Start: Install the Orchestrator

The fastest way to get started. You need a running Taskinfa dashboard (either the [hosted version](https://kanban.taskinfa.com) or [self-hosted](#self-hosted-setup)).

### Prerequisites

- **Node.js 18+**
- **[Claude Code CLI](https://claude.ai/download)** -- the orchestrator spawns `claude` sessions
- **[GitHub CLI](https://cli.github.com/)** (`gh`) -- for agents to create PRs

### One-liner Install

```bash
curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/install.sh | bash
```

The installer will prompt you for:

| Prompt | Default | Description |
|--------|---------|-------------|
| Install directory | `$PWD/.taskinfa-kanban` | Where orchestrator + CLI live |
| Projects directory | `$PWD/taskinfa-projects` | Where repos get auto-cloned |
| API key | *(required)* | From dashboard Settings > API Keys |
| Dashboard URL | `https://kanban.taskinfa.com` | Your dashboard URL |
| GitHub token | auto-detected from `gh` | For private repo access |
| Max concurrent | `3` | Parallel Claude sessions |
| Poll interval | `15` min | How often to check for tasks |
| Telegram token | *(optional)* | For push notifications |

After install, you get a `taskinfa` CLI:

```bash
taskinfa doctor     # verify everything works
taskinfa start      # start the orchestrator daemon
taskinfa status     # check if running + last log lines
taskinfa stop       # stop the orchestrator
taskinfa projects   # list projects from your dashboard
taskinfa logs       # tail orchestrator logs
```

### What Happens When You Start

1. Orchestrator polls your dashboard API for `todo` tasks
2. For any project with a GitHub repo URL that hasn't been cloned yet, it **auto-clones** to your projects directory
3. For each project with pending tasks, it spawns a Claude Code session
4. Claude works in the cloned repo, creates a branch, commits, and opens a PR
5. Task status updates to `review` with the PR URL

### Workspace Layout

```
your-directory/
+-- .taskinfa-kanban/              # TASKINFA_HOME
|   +-- config.env                 # All settings
|   +-- orchestrator.js            # Bundled daemon (~8KB)
|   +-- bin/taskinfa               # CLI script
|   +-- logs/orchestrator.log      # Daemon logs
|   +-- state/orchestrator.pid     # PID file
+-- taskinfa-projects/             # PROJECTS_DIR
    +-- my-react-app/              # Auto-cloned from GitHub
    +-- my-api-service/            # Auto-cloned from GitHub
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `taskinfa start` | Start orchestrator daemon (nohup + PID file) |
| `taskinfa stop` | Stop orchestrator |
| `taskinfa restart` | Stop + start |
| `taskinfa status` | Running state, PID, last 5 log lines |
| `taskinfa logs` | `tail -f` the orchestrator log |
| `taskinfa doctor` | Health checks: Node.js, Claude CLI, gh, config, API connectivity |
| `taskinfa update` | Download latest `orchestrator.js` from GitHub Releases |
| `taskinfa auth` | Reconfigure API key, dashboard URL, or GitHub token |
| `taskinfa projects` | List all projects with name, repo, and init status |
| `taskinfa init [id]` | Clone a project immediately (skip waiting for next poll) |
| `taskinfa version` | Show installed orchestrator version |

## Features

- **Kanban Dashboard** -- drag-and-drop task management with projects, priorities, and labels
- **Autonomous Orchestration** -- daemon polls the board, spawns Claude sessions, manages concurrency
- **Auto-Project Init** -- orchestrator auto-clones repos when you create a project with a GitHub URL
- **PR Integration** -- Claude creates branches and PRs; PR URLs are saved back to the task
- **Session Tracking** -- live view of active Claude sessions, events, and progress
- **Telegram Bot** -- `/status`, `/tasks`, `/new` commands + push notifications
- **Multi-Workspace** -- isolated workspaces with separate API keys
- **Memory System** -- file-based context persistence across Claude sessions

## Task Status Flow

```
backlog --> todo --> in_progress --> review --> done
                        ^               |
                        |  (retry on    |
                        +-- error, up --+
                            to 3x)
```

## Self-Hosted Setup

Taskinfa runs on Cloudflare Workers + D1 (free tier covers most use cases). To self-host the full stack:

### 1. Clone and Install

```bash
git clone https://github.com/secanltd/taskinfa-kanban.git
cd taskinfa-kanban
npm install
```

### 2. Create Cloudflare Resources

```bash
# Create D1 databases
wrangler d1 create taskinfa-kanban-db        # local dev
wrangler d1 create taskinfa-kanban-prod-db   # production

# Update database IDs in packages/dashboard/wrangler.toml
```

### 3. Run Database Migrations

```bash
cd packages/dashboard

# Apply all migrations (repeat for each file in migrations/)
for f in migrations/*.sql; do
  wrangler d1 execute taskinfa-kanban-db --local --file="$f"
done
```

### 4. Set Secrets

```bash
# Generate secrets
openssl rand -hex 32  # use output for JWT_SECRET

# Set for production
wrangler secret put JWT_SECRET --env production
wrangler secret put SESSION_SECRET --env production
```

### 5. Deploy Dashboard

```bash
cd packages/dashboard
npm run deploy:prod
```

### 6. Create Account and API Key

1. Visit your deployed dashboard URL
2. Sign up for an account
3. Go to **Settings** > **API Keys** > create a key
4. Save the key -- it's shown only once

### 7. Install Orchestrator

Now install the orchestrator on any machine (your laptop, a server, etc.) using the [one-liner install](#one-liner-install), pointing at your self-hosted dashboard URL.

For detailed deployment docs, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture

For a deep dive into the system design, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Components

| Component | Tech | Where It Runs |
|-----------|------|---------------|
| **Dashboard** | Next.js 15 + React 19 | Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite) | Cloudflare edge |
| **Telegram Bot** | Cloudflare Worker | Cloudflare Workers |
| **Orchestrator** | Node.js daemon (~8KB bundle) | Any machine with Node.js |
| **Claude Sessions** | Claude Code CLI | Same machine as orchestrator |

### Project Structure

```
taskinfa-kanban/
+-- packages/
|   +-- dashboard/         # Next.js app + REST API (CF Workers)
|   +-- telegram/          # Telegram bot (CF Worker, shares D1)
|   +-- shared/            # Shared TypeScript types
+-- scripts/
|   +-- orchestrator.ts    # Orchestrator daemon source
|   +-- build-orchestrator.js  # esbuild bundler
|   +-- install.sh         # Interactive installer
+-- .github/workflows/
|   +-- ci.yml             # Lint + build on PRs
|   +-- deploy.yml         # Tag-based deploy to CF Workers
|   +-- release-orchestrator.yml  # Build + release orchestrator.js
+-- docs/                  # Detailed documentation
+-- migrations/            # D1 schema migrations
```

### API Endpoints

The dashboard exposes a REST API authenticated via Bearer token (API key):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List tasks (filter by status, priority, project) |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/[id]` | Update task status, notes, PR URL |
| `GET` | `/api/task-lists` | List projects |
| `PATCH` | `/api/task-lists/[id]` | Update project (name, repo URL, working dir) |
| `GET/POST` | `/api/sessions` | Manage orchestrator sessions |
| `POST` | `/api/events` | Log session events (used by Claude hooks) |

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for the full reference.

## Development

```bash
# Start dashboard in dev mode
npm run dashboard:dev

# Start Telegram bot locally
npm run telegram:dev

# Run orchestrator directly (dev mode, reads .env)
npm run orchestrator

# Build orchestrator bundle
npm run build:orchestrator    # outputs dist/orchestrator.js

# Lint and build all packages
npm run lint
npm run build
```

### Deploying Changes

Deployments are triggered by git tags:

```bash
# Deploy dashboard to test
git tag deploy/test/2.0.9 && git push origin deploy/test/2.0.9

# Deploy dashboard to production
git tag deploy/prod/2.0.9 && git push origin deploy/prod/2.0.9

# Release new orchestrator version
git tag orchestrator/v1.0.1 && git push origin orchestrator/v1.0.1
```

### Database Migrations

```bash
cd packages/dashboard

# Apply to remote database
CLOUDFLARE_API_TOKEN=... npx wrangler d1 execute <db-name> --remote --file=./migrations/<file>.sql
```

## Telegram Bot

The Telegram bot shares the D1 database with the dashboard. Commands:

| Command | Description |
|---------|-------------|
| `/status` | Project status overview |
| `/tasks` | List pending tasks |
| `/new <project> <title>` | Create a new task |
| `/help` | Show available commands |

The bot also sends push notifications when tasks complete, get stuck, or need input.

To connect: paste your API key (`tk_...`) in the Telegram chat with your bot.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit with [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, etc.)
4. Open a Pull Request

## License

MIT License -- see [LICENSE](LICENSE) for details.

Copyright (c) 2025 [SECAN](https://secan.info)

## Links

- **Dashboard**: [kanban.taskinfa.com](https://kanban.taskinfa.com)
- **Issues**: [GitHub Issues](https://github.com/secanltd/taskinfa-kanban/issues)
- **Releases**: [GitHub Releases](https://github.com/secanltd/taskinfa-kanban/releases)
