# Architecture

System design and component overview for Taskinfa Kanban v2.

## Overview

Taskinfa is a task automation system that connects a Kanban dashboard to Claude Code via an orchestrator daemon. The dashboard and Telegram bot run on Cloudflare Workers (serverless, zero infrastructure). The orchestrator runs on any machine with Node.js and Claude Code installed.

```
+---------------------+       +---------------------+       +------------------------+
|   Browser / API     |       |   Telegram Client   |       |   Orchestrator Host    |
|                     |       |                     |       |   (your machine)       |
+----------+----------+       +----------+----------+       +----------+-------------+
           |                             |                             |
           v                             v                             v
+----------+-----------------------------+----------+       +----------+-------------+
|              Cloudflare Workers                   |       |   Orchestrator Daemon  |
|                                                   |       |   (node orchestrator.js|
|  +-- Dashboard (Next.js 15) --+                   |       |        ~8KB bundle)    |
|  |   - Kanban board UI        |                   |       |          |             |
|  |   - REST API               |                   |       |   +------+------+  x N |
|  |   - Auth (JWT + API keys)  |                   |       |   | claude -p   |      |
|  +----------------------------+                   |       |   | (per task)  |      |
|                                                   |       |   +-------------+      |
|  +-- Telegram Bot (CF Worker) --+                 |       +------------------------+
|  |   - Webhook handler          |                 |                  |
|  |   - /status /tasks /new      |                 |       polls API every 15 min
|  |   - Push notifications       |                 |       spawns Claude sessions
|  +------------------------------+                 |       reports results back
|                                                   |
|  +-- D1 Database (SQLite) ------+                 |
|  |   Shared by dashboard + bot  |                 |
|  +------------------------------+                 |
+---------------------------------------------------+
```

## Components

### Dashboard (`packages/dashboard`)

Next.js 15 app deployed to Cloudflare Workers via `@opennextjs/cloudflare`.

**Responsibilities:**
- Kanban board UI (drag-and-drop, projects, priorities)
- REST API for tasks, projects, sessions, events
- User authentication (JWT sessions + API key auth)
- Overview page (cross-project status at a glance)
- Settings page (workspace, API keys, notifications)

**Key directories:**
```
packages/dashboard/
+-- src/
|   +-- app/
|   |   +-- api/           # REST API routes
|   |   +-- auth/          # Login / signup pages
|   |   +-- dashboard/     # Kanban board
|   |   +-- overview/      # Cross-project overview
|   |   +-- projects/      # Project management
|   |   +-- settings/      # Workspace settings
|   +-- components/        # React components
|   +-- lib/
|       +-- auth/          # JWT + API key verification
|       +-- db/            # D1 database client
+-- migrations/            # SQL migration files
+-- wrangler.toml          # CF Workers config (test + prod environments)
```

### Telegram Bot (`packages/telegram`)

Lightweight Cloudflare Worker that shares the D1 database with the dashboard.

**Responsibilities:**
- Receive Telegram webhook updates
- Route commands (`/status`, `/tasks`, `/new`, `/help`)
- Send push notifications on task events
- Workspace linking via API key

**How it works:**
1. User pastes their API key (`tk_...`) in Telegram chat
2. Bot verifies the key against D1, links Telegram chat ID to workspace
3. All subsequent commands are scoped to that workspace
4. Dashboard POSTs events to `/api/events`, which triggers Telegram notifications

### Orchestrator (`scripts/orchestrator.ts`)

Node.js daemon that bridges the dashboard API with Claude Code sessions. Bundled to a single ~8KB JavaScript file via esbuild.

**Responsibilities:**
- Poll dashboard API for `todo` tasks every N minutes
- Auto-clone project repos (when `is_initialized` is false and `repository_url` is set)
- Spawn Claude Code sessions (`claude -p` with system prompt)
- Manage concurrency (max N parallel sessions)
- Report session start/end/error events back to API
- Update task status (in_progress -> review on success, back to todo on error)
- Retry failed tasks up to MAX_RETRIES times

**Config loading:**
```
TASKINFA_CONFIG=/path/to/config.env  -->  orchestrator reads key=value pairs
                                         env vars take precedence over config file
```

**Session lifecycle:**
```
1. pollCycle() called every POLL_INTERVAL
2. initializeProjects() - clone any new repos
3. getProjectTasks() - fetch todo tasks, group by project
4. For each project with tasks (up to MAX_CONCURRENT):
   a. Register session via POST /api/sessions
   b. Claim task via PATCH /api/tasks/:id {status: "in_progress"}
   c. Build system prompt (task description + git workflow)
   d. Spawn: claude -p <prompt> --dangerously-skip-permissions
   e. On exit code 0: task -> "review", session -> "completed"
   f. On error: task -> "todo" (error_count++), session -> "error"
```

### Shared Types (`packages/shared`)

TypeScript interfaces used by dashboard, bot, and orchestrator:
- `Task`, `TaskList`, `Workspace`, `User`, `ApiKey`
- `Session`, `SessionEvent`, `NotificationConfig`
- Request/response types for all API endpoints

## Database Schema

All data lives in Cloudflare D1 (SQLite). The dashboard and Telegram bot share the same database.

**Tables:**

| Table | Purpose |
|-------|---------|
| `workspaces` | Multi-tenant isolation |
| `users` | User accounts with bcrypt password hashes |
| `tasks` | Core task data (title, description, status, priority, PR URL, error count) |
| `task_lists` | Projects with repo URL, working directory, `is_initialized` flag |
| `task_comments` | Progress logs and error reports |
| `api_keys` | Bearer tokens (hashed) for API authentication |
| `sessions` | Claude Code session tracking (active, completed, error) |
| `session_events` | Event stream from orchestrator + Claude hooks |
| `notification_config` | Per-workspace Telegram notification settings |

**Migrations** are in `packages/dashboard/migrations/` (001 through 009).

## Authentication

Two auth methods, checked in order:

1. **API Key** (Bearer token) -- used by orchestrator and external clients
   - Key format: `tk_<random>`
   - Stored as SHA-256 hash in `api_keys` table
   - Scoped to a workspace

2. **JWT Session** (cookie) -- used by the dashboard UI
   - Set on login, stored as httpOnly cookie
   - Contains `userId` and `workspaceId`

Both resolve to a `workspaceId` that scopes all queries.

## Build & Release Pipeline

```
PR to main  -->  CI (lint + build)  -->  merge
                                           |
                        +------------------+------------------+
                        |                                     |
                  deploy/test/X.Y.Z                   orchestrator/vX.Y.Z
                  deploy/prod/X.Y.Z                          |
                        |                              GitHub Actions:
                  GitHub Actions:                      npm ci + esbuild
                  opennextjs-cloudflare                      |
                  deploy --env test|prod               GitHub Release
                                                       + orchestrator.js
```

**CI** (`ci.yml`): Runs `npm run lint` and `npm run build` on every PR to `main`.

**Deploy** (`deploy.yml`): Triggered by `deploy/test/*` and `deploy/prod/*` tags. Builds the Next.js app with `@opennextjs/cloudflare` and deploys to the matching CF Workers environment.

**Orchestrator Release** (`release-orchestrator.yml`): Triggered by `orchestrator/v*` tags. Runs `npm run build:orchestrator` (esbuild bundle) and attaches `orchestrator.js` to a GitHub Release.

## Key Design Decisions

**Why esbuild bundle instead of npm package?**
The orchestrator uses only Node.js built-ins (`child_process`, `fs`, `path`) plus `fetch` (built into Node 18+). A single ~8KB JS file means zero `npm install`, instant download, and trivial updates.

**Why config.env instead of just env vars?**
The install script writes all settings to a file. The CLI sources it before starting the orchestrator. This means users don't need to manage shell profiles or systemd env files -- everything lives in one place.

**Why poll-based instead of webhooks?**
Simplicity. The orchestrator runs on any machine (laptop, server, container) without needing a public URL. Polling every 15 minutes is cheap and sufficient for async task execution.

**Why Cloudflare Workers + D1?**
Zero infrastructure to maintain. Free tier covers most use cases (100K requests/day, 5M row reads/day, 5GB storage). Global edge deployment means the dashboard is fast everywhere.

**Why one Claude session per project?**
Prevents merge conflicts. Each project gets at most one active Claude session. The orchestrator picks the highest-priority task per project and processes tasks sequentially within a project.
