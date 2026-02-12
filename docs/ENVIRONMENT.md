# Environment Variables

Complete reference for all environment variables used in Taskinfa Kanban.

## Dashboard Variables

These variables configure the Next.js dashboard deployed on Cloudflare Workers.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | 256-bit secret for JWT signing |
| `SESSION_SECRET` | No | `JWT_SECRET` | Secret for session encryption |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing rounds |
| `SESSION_MAX_AGE` | No | `604800` | Session lifetime in seconds (7 days) |

### Setting Dashboard Secrets

**Local development** — create `.dev.vars` in `packages/dashboard/`:
```bash
JWT_SECRET=your-256-bit-secret-here
```

**Production** — set via Wrangler CLI:
```bash
wrangler secret put JWT_SECRET --env production
wrangler secret put SESSION_SECRET --env production
```

Or set in Cloudflare Dashboard: **Workers & Pages** > Your worker > **Settings** > **Variables** > **Secrets**.

### Generating Secrets

```bash
openssl rand -hex 32
```

## Orchestrator Variables

These variables configure the orchestrator daemon. They can be set via environment variables or in `config.env` (env vars take precedence).

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KANBAN_API_URL` | Yes | - | Dashboard URL (e.g., `https://kanban.taskinfa.com`) |
| `KANBAN_API_KEY` | Yes | - | API key from dashboard (format: `tk_...`) |
| `TASKINFA_CONFIG` | No | - | Path to `config.env` file |

### Directory Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TASKINFA_HOME` | No | - | Install directory (set by installer) |
| `PROJECTS_DIR` | No | `./projects` | Where repos are auto-cloned |

### Behavior Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POLL_INTERVAL` | No | `900000` | Milliseconds between poll cycles (default: 15 min) |
| `MAX_CONCURRENT` | No | `3` | Maximum parallel Claude Code sessions |
| `MAX_RETRIES` | No | `3` | Retries before giving up on a task |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GH_TOKEN` | No | auto-detect | GitHub token for cloning private repos |

### Telegram Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token (from @BotFather) |
| `TELEGRAM_CHAT_ID` | No | - | Telegram chat ID for notifications |

### Config File Format

The orchestrator loads settings from a config file when `TASKINFA_CONFIG` is set:

```env
# Core
KANBAN_API_URL=https://kanban.taskinfa.com
KANBAN_API_KEY=tk_your_api_key_here

# Directories
TASKINFA_HOME=/home/user/.taskinfa-kanban
PROJECTS_DIR=/home/user/taskinfa-projects

# Behavior
POLL_INTERVAL=900000
MAX_CONCURRENT=3
MAX_RETRIES=3

# Auth
GH_TOKEN=ghp_your_github_token

# Optional: Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=987654321
```

Lines starting with `#` are comments. Environment variables take precedence over config file values.

## CI/CD Variables

GitHub repository secrets needed for CI/CD:

| Variable | Where | Description |
|----------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Cloudflare API token (Workers Scripts Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets | Cloudflare account ID |

These are used by the deploy workflow (`.github/workflows/deploy.yml`) and the orchestrator release workflow (`.github/workflows/release-orchestrator.yml`).

## Security Best Practices

### Never Commit Secrets

The `.gitignore` already excludes:
```
.env
.env.local
.env.*.local
.dev.vars
```

### Use Wrangler Secrets for Production

Dashboard secrets should be set via `wrangler secret put`, not as plaintext environment variables. Wrangler secrets are encrypted at rest.

### Rotate Keys Regularly

- Rotate `JWT_SECRET` periodically (invalidates all active sessions)
- Regenerate API keys after team changes
- Use separate API keys for different orchestrator instances

### Minimum Permissions

- Create separate API keys for each orchestrator
- The Cloudflare API token only needs: D1 Edit, Workers Scripts Edit
- GitHub tokens only need repo access for the projects being managed

## Troubleshooting

### "JWT_SECRET not set"

For local dev, create `.dev.vars` in `packages/dashboard/`:
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > packages/dashboard/.dev.vars
```

For production, set via Wrangler:
```bash
wrangler secret put JWT_SECRET --env production
```

### "Invalid API key"

- Verify the key starts with `tk_`
- Check the key hasn't been revoked in dashboard Settings > API Keys
- Ensure the `Authorization: Bearer <key>` header is correct

### Orchestrator can't connect

- Verify `KANBAN_API_URL` doesn't have a trailing slash
- Verify `KANBAN_API_URL` doesn't include `/api` (the orchestrator appends it)
- Test connectivity: `curl -s "$KANBAN_API_URL/api/tasks" -H "Authorization: Bearer $KANBAN_API_KEY"`
