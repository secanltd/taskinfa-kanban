# Environment Variables

Complete reference for all environment variables used in Taskinfa Kanban.

## Dashboard Variables

These variables configure the Next.js dashboard application.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | 256-bit secret for JWT signing |
| `SESSION_SECRET` | No | `JWT_SECRET` | Secret for session encryption |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing rounds |
| `SESSION_MAX_AGE` | No | `604800` | Session lifetime in seconds (7 days) |

### Generating Secrets

```bash
# Generate a secure 256-bit secret
openssl rand -hex 32
```

## Worker Variables

These variables configure the Docker worker containers.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TASKINFA_API_KEY` | Yes | - | API key from dashboard |
| `TASKINFA_API_URL` | Yes | - | Dashboard API URL |
| `ANTHROPIC_API_KEY` | Yes | - | Claude API key |
| `BOT_NAME` | No | `Bot-John` | Worker identifier |
| `WORKSPACE_ID` | No | `default` | Workspace to work in |
| `POLL_INTERVAL` | No | `30` | Seconds between task checks |
| `MAX_LOOPS` | No | `50` | Maximum execution loops per task |

## Local Development

For local development, create a `.env` file in the project root:

```bash
# =================================
# DASHBOARD CONFIGURATION
# =================================

# Required: JWT signing secret (generate with: openssl rand -hex 32)
JWT_SECRET=your-256-bit-secret-here

# Optional: Separate session secret
SESSION_SECRET=another-256-bit-secret

# Optional: Password hashing strength (higher = slower but more secure)
BCRYPT_ROUNDS=12

# Optional: Session lifetime in seconds (default: 7 days)
SESSION_MAX_AGE=604800


# =================================
# WORKER CONFIGURATION
# =================================

# Required: API key from your dashboard
TASKINFA_API_KEY=tk_your_api_key_here

# Required: Dashboard API URL
TASKINFA_API_URL=http://localhost:3000/api

# Required: Anthropic API key for Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Worker name (appears in task assignments)
BOT_NAME=Worker-1

# Optional: Which workspace to work in
WORKSPACE_ID=default


# =================================
# DEVELOPMENT ONLY
# =================================

# GitHub token for PR workflows (optional)
GITHUB_TOKEN=ghp_your_token_here
```

## Production Setup

### Cloudflare Workers

Set these in Cloudflare Dashboard:

1. Go to **Workers & Pages** → Your worker
2. Click **Settings** → **Variables**
3. Add as **Secrets**:
   - `JWT_SECRET`
   - `SESSION_SECRET` (optional)

### Docker Workers

Pass variables via `docker-compose.yml` or `.env` file:

```yaml
services:
  worker:
    environment:
      - TASKINFA_API_KEY=${TASKINFA_API_KEY}
      - TASKINFA_API_URL=${TASKINFA_API_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## Variable Validation

The application validates required variables at startup:

| Variable | Validation |
|----------|------------|
| `JWT_SECRET` | Must be at least 32 characters |
| `TASKINFA_API_KEY` | Must start with `tk_` |
| `ANTHROPIC_API_KEY` | Must start with `sk-ant-` |
| `TASKINFA_API_URL` | Must be valid URL |

## Security Best Practices

### Never Commit Secrets

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
```

### Use Secrets Managers

For production:
- Cloudflare: Use Workers Secrets
- AWS: Use Secrets Manager
- Docker: Use Docker Secrets

### Rotate Keys Regularly

- Rotate `JWT_SECRET` periodically
- Regenerate API keys after team changes
- Update `ANTHROPIC_API_KEY` if compromised

### Minimum Permissions

- Create separate API keys for different workers
- Use read-only tokens where possible
- Revoke unused keys

## Troubleshooting

### "JWT_SECRET not set"

```bash
# Check if variable is set
echo $JWT_SECRET

# Set in .env file
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

### "Invalid API key"

```bash
# Verify key format
echo $TASKINFA_API_KEY | grep "^tk_"

# Check key in dashboard Settings
```

### "ANTHROPIC_API_KEY invalid"

```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

## Default Values

| Variable | Default | Notes |
|----------|---------|-------|
| `BCRYPT_ROUNDS` | 12 | Increase for higher security, slower logins |
| `SESSION_MAX_AGE` | 604800 | 7 days in seconds |
| `BOT_NAME` | Bot-John | Visible in task assignments |
| `WORKSPACE_ID` | default | Default workspace ID |
| `POLL_INTERVAL` | 30 | Seconds between polling |
| `MAX_LOOPS` | 50 | Safety limit for runaway tasks |
