# Deployment Guide

Deploy Taskinfa Kanban to Cloudflare Workers.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Logged in to Cloudflare (`wrangler login`)

## Architecture

```
Cloudflare Workers
├── Worker Script (.open-next/worker.js)
├── Static Assets (.open-next/assets/)
└── D1 Database (SQLite)
```

## Deployment Steps

### 1. Create D1 Database

```bash
wrangler d1 create taskinfa-kanban-db
```

Copy the `database_id` from the output.

### 2. Update wrangler.toml

Edit `packages/dashboard/wrangler.toml`:

```toml
name = "taskinfa-kanban"
main = ".open-next/worker.js"
compatibility_date = "2026-01-16"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Run Database Migrations

```bash
cd packages/dashboard

# Apply all migrations
wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/001_initial_schema.sql

wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/002_add_comments.sql

wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/003_add_users.sql

wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/004_add_task_lists_and_order.sql
```

### 4. Set Environment Variables

In Cloudflare Dashboard:

1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Settings** → **Variables**
4. Add secrets:
   - `JWT_SECRET` - 256-bit secret key
   - `SESSION_SECRET` - Another 256-bit secret

Generate secrets:
```bash
openssl rand -hex 32
```

### 5. Deploy

```bash
cd packages/dashboard
npm run deploy:prod
```

This runs:
1. `opennextjs-cloudflare build` - Build Next.js for Workers
2. `opennextjs-cloudflare deploy` - Deploy to Cloudflare

### 6. Verify Deployment

Visit your Worker URL (shown in deployment output).

Check in Cloudflare Dashboard:
- Worker is running
- D1 database is bound
- Environment variables are set

## Custom Domain

### Add Custom Domain

1. Go to **Workers & Pages** → Your worker
2. Click **Custom Domains**
3. Add your domain

### DNS Setup

Add CNAME record pointing to your worker:
```
CNAME  app  your-worker.workers.dev
```

## Updating

To deploy updates:

```bash
cd packages/dashboard
npm run deploy:prod
```

## Database Migrations

For new migrations:

```bash
wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/NEW_MIGRATION.sql
```

## Rollback

To rollback to previous version:

1. Go to Cloudflare Dashboard
2. Navigate to your worker
3. Go to **Deployments**
4. Click **Rollback** on a previous deployment

## Monitoring

### View Logs

```bash
wrangler tail
```

### In Dashboard

1. Go to **Workers & Pages**
2. Select your worker
3. Click **Logs**

## Troubleshooting

### Deployment fails

Check `wrangler.toml` configuration:
- `main` points to `.open-next/worker.js`
- `compatibility_flags` includes `["nodejs_compat"]`
- D1 binding is correct

### Database not found

Verify database ID in `wrangler.toml` matches actual database:
```bash
wrangler d1 list
```

### Environment variables not working

- Variables must be set in Workers dashboard, not Pages
- Use **Secrets** for sensitive values

## Cost Considerations

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request

D1 Free Tier:
- 5 million rows read/day
- 100,000 rows written/day
- 5 GB storage
