# Deployment Guide

Deploy Taskinfa Kanban to Cloudflare Workers.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare API token with permissions: D1 Edit, Workers Scripts Edit

## Architecture

```
Cloudflare Workers
├── taskinfa-kanban-test   (test environment)
├── taskinfa-kanban-prod   (production environment)
├── D1 Database (SQLite)
└── Static Assets (.open-next/assets/)
```

The dashboard is built with `@opennextjs/cloudflare` (NOT `@cloudflare/next-on-pages`) and deployed as a Cloudflare Worker.

## Initial Setup

### 1. Create D1 Databases

```bash
# Test database
wrangler d1 create taskinfa-kanban-test-db

# Production database
wrangler d1 create taskinfa-kanban-prod-db
```

Copy the `database_id` values from the output.

### 2. Update wrangler.toml

Edit `packages/dashboard/wrangler.toml` with your database IDs:

```toml
name = "taskinfa-kanban"
main = ".open-next/worker.js"
compatibility_date = "2026-01-16"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# Local dev database
[[d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-db"
database_id = "YOUR_LOCAL_DB_ID"

# Test environment
[env.test]
name = "taskinfa-kanban-test"

[[env.test.d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-test-db"
database_id = "YOUR_TEST_DB_ID"

# Production environment
[env.production]
name = "taskinfa-kanban-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-prod-db"
database_id = "YOUR_PROD_DB_ID"
```

### 3. Run Database Migrations

Apply all migrations (001 through 009):

```bash
cd packages/dashboard

# Test database
for f in migrations/*.sql; do
  CLOUDFLARE_API_TOKEN=your_token \
    npx wrangler d1 execute taskinfa-kanban-test-db --remote --file="$f"
done

# Production database
for f in migrations/*.sql; do
  CLOUDFLARE_API_TOKEN=your_token \
    npx wrangler d1 execute taskinfa-kanban-prod-db --remote --file="$f"
done
```

Current migrations:
| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: workspaces, tasks, task_lists |
| `002_add_comments.sql` | Task comments |
| `003_add_users.sql` | User accounts with password hashes |
| `004_add_task_lists_and_order.sql` | Task ordering and list improvements |
| `005_api_keys.sql` | API key authentication |
| `006_sessions_events_notifications.sql` | Sessions, events, notification config |
| `007_add_task_fields.sql` | PR URL, labels, error count fields |
| `008_add_overview_fields.sql` | Overview page support fields |
| `009_task_lists_initialized.sql` | Auto-project initialization flag |

### 4. Set Secrets

```bash
# Generate secrets
openssl rand -hex 32    # use for JWT_SECRET

# Test environment
wrangler secret put JWT_SECRET --env test
wrangler secret put SESSION_SECRET --env test

# Production environment
wrangler secret put JWT_SECRET --env production
wrangler secret put SESSION_SECRET --env production
```

### 5. Set Up GitHub Secrets

In your GitHub repository settings, add:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

### 6. First Deploy

```bash
cd packages/dashboard
npm run deploy:test     # deploy to test
npm run deploy:prod     # deploy to production
```

## Tag-Based Deployments

After initial setup, deployments are triggered by git tags via GitHub Actions.

### Deploy Dashboard

```bash
# Deploy to test
git tag deploy/test/2.0.10 && git push origin deploy/test/2.0.10

# Deploy to production
git tag deploy/prod/2.0.10 && git push origin deploy/prod/2.0.10
```

The deploy workflow (`.github/workflows/deploy.yml`):
1. Builds the Next.js app with `opennextjs-cloudflare build`
2. Deploys to the matching environment with `opennextjs-cloudflare deploy`

### Release Orchestrator

```bash
git tag orchestrator/v1.0.1 && git push origin orchestrator/v1.0.1
```

The release workflow (`.github/workflows/release-orchestrator.yml`):
1. Runs `npm run build:orchestrator` (esbuild bundle)
2. Creates a GitHub Release with `orchestrator.js` attached

Users update via `taskinfa update`, which downloads the latest release.

## CI/CD Pipeline

```
PR to main  →  CI (lint + build)  →  merge
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
              deploy/test/*     deploy/prod/*     orchestrator/v*
                    │                  │                   │
              Deploy to test    Deploy to prod     GitHub Release
              environment       environment        + orchestrator.js
```

- **CI** (`ci.yml`): Runs `npm run lint` and `npm run build` on every PR to `main`
- **Deploy** (`deploy.yml`): Triggered by `deploy/test/*` and `deploy/prod/*` tags
- **Orchestrator** (`release-orchestrator.yml`): Triggered by `orchestrator/v*` tags

## Applying New Migrations

When a new migration is added:

```bash
cd packages/dashboard

# Apply to test
CLOUDFLARE_API_TOKEN=your_token \
  npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --file=./migrations/NEW_MIGRATION.sql

# Apply to production
CLOUDFLARE_API_TOKEN=your_token \
  npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --file=./migrations/NEW_MIGRATION.sql
```

## Custom Domain

Configure a custom domain in the Cloudflare Dashboard:

1. Go to **Workers & Pages** > Your worker
2. Click **Custom Domains**
3. Add your domain (e.g., `kanban.taskinfa.com`)

Cloudflare handles DNS and SSL automatically.

## Monitoring

### View Logs

```bash
# Live tail
wrangler tail --env production

# Or in Cloudflare Dashboard
# Workers & Pages > Your worker > Logs
```

Observability is enabled in `wrangler.toml`:
```toml
[observability]
[observability.logs]
enabled = true
invocation_logs = true
```

## Rollback

To rollback to a previous version:

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** > Your worker
3. Go to **Deployments**
4. Click **Rollback** on a previous deployment

## Troubleshooting

### Deployment fails

- Verify `main` in wrangler.toml points to `.open-next/worker.js`
- Verify `compatibility_flags` includes `["nodejs_compat"]`
- Check that `open-next.config.ts` exists in `packages/dashboard/`

### Database not found

```bash
# List all D1 databases
wrangler d1 list

# Verify database IDs match wrangler.toml
```

### Secrets not working

- Secrets must be set via `wrangler secret put`, not as plaintext variables
- Each environment (test, production) needs its own secrets
- Verify in Cloudflare Dashboard: Workers > Settings > Variables

## Cost

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request

D1 Free Tier:
- 5 million rows read/day
- 100,000 rows written/day
- 5 GB storage

This covers most Taskinfa use cases.
