# Worker Setup Guide

Set up Docker workers to automatically execute tasks from your Kanban board.

## Overview

Workers are Docker containers that:
- Poll the API for available tasks
- Claim tasks atomically (no duplicates)
- Execute work using Claude Code CLI
- Log progress and results

## Prerequisites

1. **Docker** and **Docker Compose** installed
2. **API key** from your Taskinfa dashboard
3. **Anthropic API key** (Claude API)

## Quick Start

### 1. Configure Environment

Create or update `.env`:

```bash
# Required
TASKINFA_API_KEY=tk_your_api_key_here
TASKINFA_API_URL=https://your-instance.workers.dev/api
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional
BOT_NAME=Worker-1
WORKSPACE_ID=default
```

### 2. Start a Worker

```bash
./scripts/docker-manage.sh start
```

Or with Docker Compose directly:

```bash
docker-compose up -d bot-john
```

### 3. View Logs

```bash
./scripts/docker-manage.sh logs
```

Or:

```bash
docker-compose logs -f bot-john
```

## Worker Configuration

### docker-compose.yml

```yaml
services:
  bot-john:
    build:
      context: .
      dockerfile: packages/bot/Dockerfile
    container_name: bot-john
    environment:
      - TASKINFA_API_KEY=${TASKINFA_API_KEY}
      - TASKINFA_API_URL=${TASKINFA_API_URL:-http://host.docker.internal:3000/api}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - BOT_NAME=${BOT_NAME:-Bot-John}
      - WORKSPACE_ID=${WORKSPACE_ID:-default}
    volumes:
      - ./workspace:/workspace
      - ~/.claude:/home/worker/.claude:ro
    restart: unless-stopped
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TASKINFA_API_KEY` | Yes | API key from dashboard |
| `TASKINFA_API_URL` | Yes | Dashboard API URL |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `BOT_NAME` | No | Worker identifier (default: Bot-John) |
| `WORKSPACE_ID` | No | Workspace to work in (default: default) |

## Multiple Workers

### Run Multiple Workers

Add more services to `docker-compose.yml`:

```yaml
services:
  bot-john:
    # ... (as above)

  bot-gordon:
    build:
      context: .
      dockerfile: packages/bot/Dockerfile
    container_name: bot-gordon
    environment:
      - TASKINFA_API_KEY=${TASKINFA_API_KEY}
      - TASKINFA_API_URL=${TASKINFA_API_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - BOT_NAME=Bot-Gordon
      - WORKSPACE_ID=${WORKSPACE_ID:-default}
    volumes:
      - ./workspace:/workspace
      - ~/.claude:/home/worker/.claude:ro
```

Start all workers:

```bash
docker-compose up -d
```

### Task Claiming

Workers use atomic task claiming to prevent duplicates:
1. Worker requests next available task
2. Server atomically assigns task to worker
3. Other workers skip claimed tasks

## Worker Workflow

```
┌─────────────────┐
│  Check for      │
│  available task │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Claim task     │
│  (atomic)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute with   │
│  Claude Code    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Log progress   │
│  and comments   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Mark complete  │
│  (status: review)│
└────────┬────────┘
         │
         ▼
      [Loop]
```

## Directory Structure

```
taskinfa-kanban/
├── workspace/              # Shared workspace for workers
│   └── project-name/       # Cloned repositories
├── logs/                   # Worker logs
│   ├── bot-john/
│   └── bot-gordon/
└── docker-compose.yml
```

## Monitoring

### View Running Workers

```bash
docker-compose ps
```

### View Specific Worker Logs

```bash
docker-compose logs -f bot-john
```

### Access Worker Shell

```bash
docker exec -it bot-john bash
```

### Check Worker Status

```bash
docker exec -it bot-john cat /var/log/worker/status.log
```

## Security

### Container Isolation

- Workers run as non-root user
- Network access is restricted
- Claude config is mounted read-only

### Network Restrictions

Workers can only access:
- Your Taskinfa API
- Claude API (api.anthropic.com)
- npm registry
- GitHub (for cloning)

### Secrets Management

- Never commit API keys to git
- Use `.env` file (git-ignored)
- Consider Docker secrets for production

## Troubleshooting

### Worker won't start

```bash
# Check Docker logs
docker-compose logs bot-john

# Verify environment variables
docker-compose config

# Check Claude auth
docker exec -it bot-john ls ~/.claude
```

### Worker can't connect to API

```bash
# Test API connectivity
docker exec -it bot-john curl $TASKINFA_API_URL/tasks

# Check network
docker exec -it bot-john ping host.docker.internal
```

### Tasks not being claimed

- Verify `WORKSPACE_ID` matches task workspace
- Check task status (must be "todo")
- Review worker logs for errors

### Claude Code errors

```bash
# Check Claude Code logs
docker exec -it bot-john cat /var/log/worker/claude.log

# Verify API key
docker exec -it bot-john echo $ANTHROPIC_API_KEY | head -c 10
```

## Development

### Local Testing (without Docker)

```bash
cd packages/bot
npm run dev
```

### Build Docker Image

```bash
docker-compose build bot-john
```

### Run with Custom Config

```bash
docker-compose run --rm \
  -e BOT_NAME=Custom-Worker \
  bot-john
```

## Scaling

For production workloads:

1. Run workers on separate machines
2. Use container orchestration (Kubernetes, ECS)
3. Monitor with Prometheus/Grafana
4. Set up log aggregation

## Next Steps

- [API Reference](API_REFERENCE.md)
- [Architecture](ARCHITECTURE.md)
- [Environment Variables](ENVIRONMENT.md)
