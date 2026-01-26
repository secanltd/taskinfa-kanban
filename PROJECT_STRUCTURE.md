# Taskinfa-Bot Project Structure

Complete file tree showing all components of the system.

```
taskinfa-bot/
├── README.md                      # Main project documentation
├── LICENSE                        # MIT license
├── SETUP.md                       # Detailed setup guide
├── CONTRIBUTING.md                # Contribution guidelines
├── package.json                   # Root workspace config
├── turbo.json                     # Turborepo configuration
├── .gitignore                     # Git ignore rules
├── .env.example                   # Environment variables template
├── .eslintrc.json                 # ESLint configuration
├── .prettierrc                    # Prettier code formatter
│
├── scripts/
│   ├── setup.sh                   # Automated setup script
│   └── generate-api-key.js        # API key generation utility
│
└── packages/
    │
    ├── shared/                    # Shared TypeScript types
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       └── types/
    │           └── index.ts       # Core domain types
    │
    ├── dashboard/                 # Next.js dashboard + MCP server
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── next.config.ts
    │   ├── wrangler.toml          # Cloudflare D1 config
    │   ├── schema.sql             # Database schema
    │   ├── tailwind.config.ts
    │   ├── postcss.config.mjs
    │   │
    │   └── src/
    │       ├── app/
    │       │   ├── layout.tsx     # Root layout
    │       │   ├── page.tsx       # Home page with kanban
    │       │   ├── globals.css    # Global styles
    │       │   │
    │       │   └── api/
    │       │       └── tasks/
    │       │           ├── route.ts      # List/Create tasks
    │       │           └── [id]/
    │       │               └── route.ts  # Get/Update/Delete task
    │       │
    │       ├── components/
    │       │   └── KanbanBoard.tsx       # Kanban UI component
    │       │
    │       └── lib/
    │           ├── db/
    │           │   └── client.ts         # D1 database client
    │           │
    │           ├── auth/
    │           │   └── jwt.ts            # JWT authentication
    │           │
    │           └── mcp/
    │               └── server.ts         # MCP server implementation
    │
    └── bot/                       # Task executor (Ralph fork)
        ├── package.json
        ├── tsconfig.json
        │
        └── src/
            ├── index.ts           # CLI entry point
            │
            ├── loop/
            │   └── executor.ts    # Main execution loop
            │
            ├── client/
            │   └── mcp-client.ts  # MCP client wrapper
            │
            └── claude/
                └── runner.ts      # Claude Code CLI wrapper
```

## Key Components

### Dashboard (`packages/dashboard`)

**Purpose**: Web interface and API server

**Core Files**:
- `schema.sql` - D1 database schema with workspaces, tasks, api_keys tables
- `src/lib/mcp/server.ts` - MCP server exposing task management tools
- `src/lib/auth/jwt.ts` - JWT-based API key authentication
- `src/components/KanbanBoard.tsx` - React kanban board UI
- `src/app/api/tasks/*` - REST API endpoints

**Tech Stack**:
- Next.js 15 (App Router)
- React 19
- Cloudflare D1 (SQLite)
- Tailwind CSS
- MCP SDK

### Bot (`packages/bot`)

**Purpose**: Autonomous task executor

**Core Files**:
- `src/loop/executor.ts` - Main task execution loop with circuit breaker
- `src/client/mcp-client.ts` - MCP client for dashboard communication
- `src/claude/runner.ts` - Claude Code CLI wrapper
- `src/index.ts` - CLI interface with Commander.js

**Tech Stack**:
- Node.js (ES Modules)
- TypeScript
- MCP SDK
- Commander.js (CLI)
- Chalk (colored output)

### Shared (`packages/shared`)

**Purpose**: Common TypeScript types

**Core Files**:
- `src/types/index.ts` - All domain types (Task, Workspace, ApiKey, etc.)

## Data Flow

```
User → Dashboard UI → D1 Database → Task (status: todo)
                ↓
           MCP Server
                ↓
        Bot MCP Client → Executor Loop
                ↓
          Claude Code CLI
                ↓
        File modifications
                ↓
        Status update (review)
                ↓
           Dashboard UI
```

## Build Outputs

After running `npm run build`:

```
packages/shared/dist/       # Compiled TypeScript types
packages/dashboard/.next/   # Next.js build output
packages/bot/dist/          # Compiled bot executable
```

## Configuration Files

- `.env` - Environment variables (not in repo)
- `.env.example` - Template for environment variables
- `wrangler.toml` - Cloudflare D1 configuration
- `turbo.json` - Monorepo build pipeline
- `tsconfig.json` - TypeScript configuration (per package)

## Database Schema

**Tables**:
1. `workspaces` - Multi-tenant isolation
2. `tasks` - Core task data with execution metadata
3. `api_keys` - Authentication tokens

**Indexes**:
- `idx_tasks_workspace_status` - Fast task queries
- `idx_tasks_priority` - Priority filtering
- `idx_api_keys_hash` - Authentication lookups

## Scripts

**Root**:
- `npm run build` - Build all packages
- `npm run dev` - Start all packages in dev mode
- `npm run dashboard:dev` - Start dashboard only
- `npm run bot:run` - Run bot

**Dashboard**:
- `npm run db:migrate` - Run local database migration
- `npm run db:migrate:prod` - Run production migration
- `npm run deploy` - Deploy to Cloudflare Pages

**Bot**:
- `npm start -- run` - Execute bot with default settings
- `npm run dev` - Watch mode for development

## Testing Strategy

1. **Dashboard**: Test Next.js pages and API routes
2. **Bot**: Test executor loop logic and Claude Code integration
3. **Integration**: End-to-end task execution flow
4. **MCP**: Test server tools and client communication

## Deployment

**Dashboard**: Cloudflare Pages + D1
**Bot**: Local machine, cron job, or cloud function
**Database**: Cloudflare D1 (replicated globally)

## Future Enhancements

- Web UI for task creation and management
- Real-time task status updates (WebSockets)
- Task scheduling and cron expressions
- Multi-user authentication
- Task dependencies and workflows
- Analytics dashboard
- Webhook notifications
- Claude Code session management
