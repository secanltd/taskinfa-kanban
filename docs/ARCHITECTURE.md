# Architecture

This document describes the system architecture and project structure of Taskinfa Kanban.

## Overview

Taskinfa Kanban is a monorepo containing three main packages:

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/    # Next.js web app + API + MCP server
│   ├── bot/          # Autonomous task executor
│   └── shared/       # TypeScript types and utilities
├── scripts/          # Shell scripts for deployment and management
└── docs/             # Documentation
```

## Package Details

### Dashboard (`packages/dashboard`)

**Purpose**: Web interface, REST API, and MCP server

**Tech Stack**:
- Next.js 15 (App Router)
- React 19
- Cloudflare D1 (SQLite)
- Tailwind CSS
- MCP SDK

**Key Directories**:
```
src/
├── app/              # Next.js routes and API
│   ├── api/          # REST API endpoints
│   └── (dashboard)/  # Dashboard pages
├── components/       # React components
└── lib/
    ├── auth/         # Authentication (JWT, sessions)
    ├── db/           # Database client
    └── mcp/          # MCP server implementation
```

### Bot (`packages/bot`)

**Purpose**: Autonomous task executor using Claude Code

**Tech Stack**:
- Node.js (ES Modules)
- TypeScript
- MCP SDK
- Commander.js (CLI)

**Key Files**:
- `src/index.ts` - CLI entry point
- `src/loop/executor.ts` - Main execution loop with circuit breaker
- `src/client/mcp-client.ts` - MCP client for API communication
- `src/claude/runner.ts` - Claude Code CLI wrapper

### Shared (`packages/shared`)

**Purpose**: Common TypeScript types

**Key Files**:
- `src/types/index.ts` - Domain types (Task, Workspace, ApiKey, etc.)

## Data Flow

```
User Interface
      │
      ▼
┌─────────────────┐
│  Dashboard API  │
│  (Next.js)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  D1 Database    │
│  (SQLite)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MCP Server    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bot Executor   │
│  (Docker)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Claude Code    │
│  CLI            │
└─────────────────┘
```

## Database Schema

**Tables**:

1. `workspaces` - Multi-tenant isolation
2. `users` - User accounts with authentication
3. `tasks` - Core task data with execution metadata
4. `task_lists` - Project groupings
5. `task_comments` - Progress and error logs
6. `api_keys` - Authentication tokens

**Key Indexes**:
- `idx_tasks_workspace_status` - Fast task queries
- `idx_tasks_priority` - Priority filtering
- `idx_api_keys_hash` - Authentication lookups

## Worker Architecture

Workers run in isolated Docker containers:

```
┌─────────────────────────────────────────────────────┐
│  Docker Container: "worker-1"                       │
│  ├─ Node.js 20                                      │
│  ├─ Claude Code CLI                                 │
│  ├─ Taskinfa Bot                                    │
│  ├─ Network restrictions                            │
│  └─ Mounted workspace (/workspace)                  │
└─────────────────────────────────────────────────────┘
                    │
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Dashboard                               │
│  ├─ D1 Database                                     │
│  ├─ REST API                                        │
│  └─ MCP Server                                      │
└─────────────────────────────────────────────────────┘
```

### Worker Workflow

1. **Fetch Task** - Get highest priority unclaimed task
2. **Claim Task** - Atomically claim to prevent race conditions
3. **Execute** - Run Claude Code CLI with task instructions
4. **Log Progress** - Add comments during execution
5. **Complete** - Move to "review" with summary
6. **Loop** - Repeat until no more tasks

## Build Pipeline

The project uses Turborepo for build orchestration:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "dependsOn": ["^build"]
    }
  }
}
```

Build order: `shared` → `dashboard` + `bot` (parallel)

## Deployment

- **Dashboard**: Cloudflare Workers (via `@opennextjs/cloudflare`)
- **Database**: Cloudflare D1 (replicated globally)
- **Workers**: Docker containers on any machine with Docker

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.
