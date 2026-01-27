# Taskinfa Worker Setup Guide

This guide explains how to set up and use the automated Taskinfa worker containers that execute tasks from your kanban board.

## Overview

The worker system uses:
- **Claude Code native features** for task execution
- **MCP server** for task management (already built)
- **Docker containers** for isolated worker environments
- **Task Lists** as projects (one task list = one project)
- **Claude Code Task Lists** (`CLAUDE_CODE_TASK_LIST_ID`) for multi-session coordination

## Prerequisites

1. **Claude Code CLI** installed on your host machine:
   ```bash
   curl -fsSL https://claude.sh/install.sh | bash
   ```

2. **Claude authentication** configured:
   ```bash
   claude login
   ```
   This creates `~/.claude` directory with your credentials.

3. **Docker and Docker Compose** installed

4. **Database migration applied**:
   ```bash
   cd packages/dashboard
   npx wrangler d1 execute taskinfa-kanban-db --local \
     --file=./migrations/004_add_task_lists_and_order.sql

   # For production:
   npx wrangler d1 execute taskinfa-kanban-db --remote \
     --file=./migrations/004_add_task_lists_and_order.sql
   ```

## Quick Start

### Step 1: Create a Task List (Project)

Via the dashboard (after UI is implemented):
1. Go to https://taskinfa-kanban.secan-ltd.workers.dev/dashboard
2. Click "Create Task List"
3. Fill in:
   - **Name**: `company-website`
   - **Description**: `Main company website`
   - **Repository URL**: `https://github.com/yourorg/company-website` (optional)
   - **Working Directory**: `/workspace` (default)

Or via SQL:
```sql
INSERT INTO task_lists (id, workspace_id, name, description, repository_url)
VALUES (
  'company-website',
  'default',
  'Company Website',
  'Main company website project',
  'https://github.com/yourorg/company-website'
);
```

### Step 2: Add Tasks to the Task List

Create tasks and assign them to your task list:
```sql
INSERT INTO tasks (
  id, workspace_id, task_list_id, title, description, status, priority, "order"
)
VALUES (
  'task_001',
  'default',
  'company-website',
  'Fix login bug',
  'Login fails with correct credentials. Check auth/LoginForm.tsx',
  'todo',
  'high',
  0  -- Top of column = highest priority
);
```

### Step 3: Build the Worker Container

```bash
# From project root
docker-compose -f docker-compose.workers.yml build
```

### Step 4: Start Workers

#### Single Worker
```bash
docker-compose -f docker-compose.workers.yml up -d worker-company-website-1
```

#### Multiple Workers (for faster execution)
```bash
docker-compose -f docker-compose.workers.yml --profile multi-worker up -d
```

#### Start All Projects
```bash
docker-compose -f docker-compose.workers.yml --profile other-projects up -d
```

### Step 5: Monitor Workers

```bash
# View logs
docker-compose -f docker-compose.workers.yml logs -f worker-company-website-1

# Access container
docker exec -it worker-company-website-1 bash

# Check supervisord status
docker exec -it worker-company-website-1 supervisorctl status

# View session logs
docker exec -it worker-company-website-1 ls /var/log/worker/
```

### Step 6: Review Completed Work

1. Workers move tasks to "review" status when complete
2. Check workspace directory: `./workspace-company-website/`
3. Review code changes
4. Test functionality
5. Move task to "done" if approved, or back to "todo" with comments if changes needed

## Architecture

### Task Lists = Projects

Each **task list** represents a **project**:
- Has its own repository URL
- Has dedicated workspace directory
- Maps to `CLAUDE_CODE_TASK_LIST_ID` for multi-session coordination
- Can have multiple workers assigned

### Directory Structure

```
taskinfa-bot/
├── workspace-company-website/     # Project workspace
│   └── company-website/            # Git repo cloned here
├── workspace-mobile-app/           # Another project
│   └── mobile-app/
├── logs/                           # Worker logs
│   ├── company-website-1/
│   ├── company-website-2/
│   └── mobile-app-1/
├── .claude/
│   └── skills/
│       └── taskinfa-kanban/        # Worker skill
└── docker-compose.workers.yml
```

### Worker Workflow

Each worker follows this cycle:

1. **Check project status** - Get task list info, clone repo if needed
2. **Fetch next task** - Get highest priority unclaimed task (top of "To Do" column)
3. **Claim task** - Atomically claim to prevent race conditions
4. **Execute work** - Make code changes, run tests
5. **Mark complete** - Move to "review" with detailed notes
6. **Loop** - Repeat until no more tasks

### Multi-Session Coordination

Workers use `CLAUDE_CODE_TASK_LIST_ID` to coordinate:
- Each worker for a project sets same `CLAUDE_CODE_TASK_LIST_ID`
- Claude Code shares task state across sessions
- Prevents duplicate work
- Enables parallel execution

## Configuration

### Environment Variables

Set in `docker-compose.workers.yml`:

```yaml
environment:
  - WORKSPACE_ID=default          # Your workspace
  - TASK_LIST_ID=company-website  # Project/task list ID
  - WORKER_NAME=Worker-1          # Unique worker name
  - POLL_INTERVAL=30              # Seconds between checks
  - MCP_SERVER_CMD=node           # MCP server command
  - MCP_SERVER_ARGS=/app/mcp/server.js
```

### Claude Authentication

Workers use your Claude session:
```yaml
volumes:
  - ~/.claude:/home/worker/.claude:ro  # Read-only mount
```

## Task Priority

Tasks are ordered by the `order` field within each status column:
- `order = 0` = Top of column (highest priority)
- `order = 1` = Second
- `order = 2` = Third
- etc.

Workers always fetch tasks with `ORDER BY "order" ASC`, so they work on top tasks first.

## Advanced Usage

### Custom Worker for New Project

1. Add service in `docker-compose.workers.yml`:
```yaml
worker-my-project-1:
  build:
    context: .
    dockerfile: Dockerfile.worker
  container_name: worker-my-project-1
  environment:
    - WORKSPACE_ID=default
    - TASK_LIST_ID=my-project
    - WORKER_NAME=Worker-1
  volumes:
    - ./workspace-my-project:/workspace
    - ~/.claude:/home/worker/.claude:ro
    - ./logs/my-project-1:/var/log/worker
  networks:
    - taskinfa-net
```

2. Start worker:
```bash
docker-compose -f docker-compose.workers.yml up -d worker-my-project-1
```

### Scaling Workers

To add more workers to a project:
1. Duplicate service definition
2. Change container name and worker name
3. Use **same** `TASK_LIST_ID` and workspace volume
4. Start additional workers

### Debugging

**Check worker logs:**
```bash
docker-compose -f docker-compose.workers.yml logs worker-company-website-1
```

**View Claude Code sessions:**
```bash
docker exec -it worker-company-website-1 ls -lah /var/log/worker/
docker exec -it worker-company-website-1 cat /var/log/worker/session-<timestamp>.log
```

**Access worker shell:**
```bash
docker exec -it worker-company-website-1 bash
cd /workspace
ls -la
```

**Check MCP server:**
```bash
docker exec -it worker-company-website-1 node /app/mcp/server.js
```

## Troubleshooting

### Worker not starting
- Check Docker logs: `docker-compose logs worker-company-website-1`
- Verify Claude auth: `docker exec -it worker-company-website-1 ls ~/.claude`
- Check MCP server exists: `docker exec -it worker-company-website-1 ls /app/mcp/`

### Tasks not being claimed
- Verify task list ID matches: Check `TASK_LIST_ID` env var
- Check task status: Tasks must be in `todo` status
- Verify workspace ID: Should match worker's `WORKSPACE_ID`

### Project not cloning
- Check repository URL in task list
- Verify network access from container
- Check worker logs for git errors

### Multiple workers claiming same task
- This shouldn't happen - `claim_task` is atomic
- If it does, check MCP server implementation
- Verify database supports transactions

## Security Notes

- Worker containers run as non-root user `worker`
- `~/.claude` is mounted read-only
- Workers have full file system access within workspace
- No sensitive credentials in environment variables
- Use secrets management for production

## Next Steps

1. **Build Dashboard UI** for task list management
2. **Add drag-and-drop** for task ordering
3. **Implement metrics** - track completion rate, errors
4. **Add health checks** - monitor worker liveness
5. **Support task dependencies** - block tasks until dependencies complete

## Support

For issues or questions:
- Check logs first
- Review this guide
- Check MCP server implementation
- File issue on GitHub

---

**Last Updated:** January 27, 2026
**Version:** 1.0.0
