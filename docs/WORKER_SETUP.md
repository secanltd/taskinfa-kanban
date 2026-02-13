# Orchestrator Setup Guide

Set up the Taskinfa orchestrator to automatically execute tasks from your Kanban board using Claude Code.

## Overview

The orchestrator is a lightweight Node.js daemon (~8KB) that:
- Polls the dashboard API for `todo` tasks
- Auto-clones project repos from GitHub
- Spawns Claude Code sessions (`claude -p`) per task
- Reports results back — tasks move to `review` with PR URLs
- Manages concurrency (max N parallel sessions)

## Prerequisites

1. **Node.js 18+** (`node --version`)
2. **[Claude Code CLI](https://claude.ai/download)** — the orchestrator spawns `claude` sessions
3. **[GitHub CLI](https://cli.github.com/)** (`gh`) — for creating PRs
4. **API key** from your Taskinfa dashboard (Settings > API Keys)

## Quick Start (One-liner Install)

```bash
curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/install.sh | bash
```

The installer prompts for:

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

## Workspace Layout

After install, your directory looks like:

```
your-directory/
├── .taskinfa-kanban/              # TASKINFA_HOME
│   ├── config.env                 # All settings
│   ├── orchestrator.js            # Bundled daemon (~8KB)
│   ├── bin/taskinfa               # CLI script
│   ├── logs/orchestrator.log      # Daemon logs
│   └── state/orchestrator.pid     # PID file
└── taskinfa-projects/             # PROJECTS_DIR
    ├── my-react-app/              # Auto-cloned from GitHub
    └── my-api-service/            # Auto-cloned from GitHub
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

## Configuration

All settings live in `config.env`:

```env
# Core
KANBAN_API_URL=https://kanban.taskinfa.com
KANBAN_API_KEY=tk_your_api_key_here

# Directories
TASKINFA_HOME=/path/to/.taskinfa-kanban
PROJECTS_DIR=/path/to/taskinfa-projects

# Behavior
POLL_INTERVAL=900000        # 15 minutes in ms
MAX_CONCURRENT=3            # Max parallel Claude sessions
MAX_RETRIES=3               # Retries before task is marked blocked

# Auth
GH_TOKEN=ghp_...            # GitHub token (for private repos)

# Optional: Telegram notifications
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Environment variables take precedence over `config.env` values.

See [ENVIRONMENT.md](ENVIRONMENT.md) for the full variable reference.

## How It Works

### Poll Cycle

Every `POLL_INTERVAL` milliseconds, the orchestrator:

1. **Initializes projects** — clones repos for any projects with a `repository_url` that haven't been cloned yet
2. **Fetches tasks** — gets all `todo` tasks from the API, grouped by project
3. **Spawns sessions** — for each project with pending tasks (up to `MAX_CONCURRENT`):
   - Registers a session via `POST /api/sessions`
   - Claims the highest-priority task via `PATCH /api/tasks/:id`
   - Builds a system prompt with the task description and git workflow
   - Spawns: `claude -p <prompt> --dangerously-skip-permissions`
4. **Reports results**:
   - On success (exit 0): task → `review`, session → `completed`
   - On error: task → `todo` (error_count++), session → `error`

### Concurrency Model

One Claude session per project at a time. This prevents merge conflicts. The orchestrator picks the highest-priority task per project and processes tasks sequentially within a project.

### Auto-Project Init

When you create a project in the dashboard with a GitHub repo URL:
1. The orchestrator detects `is_initialized = false` on the next poll cycle
2. It clones the repo to `$PROJECTS_DIR/<project-name>/`
3. Marks the project as initialized via `PATCH /api/task-lists/:id`
4. Future tasks for this project run in the cloned directory

## Updating

Download the latest orchestrator from GitHub Releases:

```bash
taskinfa update
```

Or manually:

```bash
curl -fsSL https://github.com/secanltd/taskinfa-kanban/releases/latest/download/orchestrator.js \
  -o $TASKINFA_HOME/orchestrator.js
```

## Running Without the CLI

You can run the orchestrator directly:

```bash
# With config file
TASKINFA_CONFIG=/path/to/config.env node /path/to/orchestrator.js

# With environment variables
KANBAN_API_URL=https://kanban.taskinfa.com \
KANBAN_API_KEY=tk_your_key \
PROJECTS_DIR=/path/to/projects \
node orchestrator.js
```

## Troubleshooting

### Orchestrator won't start

```bash
taskinfa doctor    # Run health checks
taskinfa logs      # Check for errors
```

Common issues:
- Node.js < 18: The orchestrator requires Node.js 18+ for built-in `fetch`
- Claude CLI not installed: Install from https://claude.ai/download
- Invalid API key: Regenerate in dashboard Settings > API Keys

### Tasks not being picked up

- Check task status is `todo` (not `backlog` or another status)
- Verify the project has a `working_directory` or `repository_url`
- Check for stale `active` sessions: killed orchestrator processes can leave sessions stuck as `active`. Clean up via the dashboard or API.

### Claude session errors

Check the orchestrator log for error details:

```bash
taskinfa logs
```

Tasks that fail are retried up to `MAX_RETRIES` times (default 3). After that, the task stays as `todo` with an incremented `error_count`.

### Stale sessions

If the orchestrator is killed mid-session, sessions may remain `active` in the API. The orchestrator skips projects with active sessions. To fix:

```bash
# List active sessions
curl -s "$KANBAN_API_URL/api/sessions?status=active" \
  -H "Authorization: Bearer $KANBAN_API_KEY" | jq .

# Mark stale session as completed
curl -X PATCH "$KANBAN_API_URL/api/sessions/<id>" \
  -H "Authorization: Bearer $KANBAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

## Next Steps

- [Environment Variables](ENVIRONMENT.md)
- [API Reference](API_REFERENCE.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
