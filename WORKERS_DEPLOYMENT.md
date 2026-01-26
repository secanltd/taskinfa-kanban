# Taskinfa-Kanban Workers Deployment

## 🚀 Live Deployment (Workers)

**Production URL**: https://taskinfa-kanban.secan-ltd.workers.dev
**Platform**: Cloudflare Workers with OpenNext
**Version**: 1.0.0 (Workers)

## Why Workers Instead of Pages?

We migrated from Cloudflare Pages to Workers for the following benefits:

### ✅ Workers + OpenNext Advantages
- **Node.js Runtime**: Full Node.js API support, not just Edge runtime
- **All Next.js Features**: ISR, Image Optimization, Server Components, etc.
- **Standard API Routes**: No need for `export const runtime = "edge"`
- **Better D1 Integration**: Proper database bindings in Workers
- **Active Maintenance**: OpenNext is officially supported by Cloudflare
- **Full Feature Parity**: Works with Next.js 14, 15, and 16

### ❌ Pages Limitations
- Only Edge runtime support
- Limited Next.js features
- Required `@cloudflare/next-on-pages` (deprecated)
- API routes need special configuration
- D1 bindings more complex

## Architecture

```
Next.js App → OpenNext Build → Worker.js → Cloudflare Workers
                                    ↓
                              D1 Database
                              Static Assets
```

## Configuration

### wrangler.jsonc
```jsonc
{
  "name": "taskinfa-kanban",
  "main": ".open-next/worker.js",  // OpenNext generates this
  "compatibility_date": "2025-01-26",
  "compatibility_flags": [
    "nodejs_compat",  // Required for Node.js APIs
    "global_fetch_strictly_public"
  ],

  // D1 Database Binding
  "d1_databases": [{
    "binding": "DB",
    "database_name": "taskinfa-kanban-db",
    "database_id": "e2f4e8ae-71a3-4234-8db1-3abda4a4438d"
  }],

  // Static Assets
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

### open-next.config.ts
```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // OpenNext configuration
});
```

## Build & Deploy Process

### 1. Install Dependencies
```bash
cd packages/dashboard-workers
npm install
```

### 2. Build Next.js
```bash
npm run build
# Runs: next build
```

### 3. Build with OpenNext
```bash
npx opennextjs-cloudflare build
# Generates:
# - .open-next/worker.js (Workers entry point)
# - .open-next/assets/ (Static files)
# - .open-next/server-functions/ (SSR functions)
```

### 4. Deploy to Workers
```bash
npx wrangler deploy
# Or use: npm run deploy
# Which runs: opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "db:migrate": "wrangler d1 execute taskinfa-kanban-db --local --file=./schema.sql",
    "db:migrate:prod": "wrangler d1 execute taskinfa-kanban-db --remote --file=./schema.sql"
  }
}
```

## Environment Variables

### Production (Workers Secrets)
```bash
# Set JWT secret
echo "YOUR_SECRET" | npx wrangler secret put JWT_SECRET

# Current secret
JWT_SECRET=8306b2e1f3583e2fc2f12963a7b419276b34293071193da8151d32a6954e454a
```

### Development (.dev.vars)
```
NEXTJS_ENV=development
JWT_SECRET=8306b2e1f3583e2fc2f12963a7b419276b34293071193da8151d32a6954e454a
```

## Database Setup

### D1 Database
- **Name**: taskinfa-kanban-db
- **ID**: e2f4e8ae-71a3-4234-8db1-3abda4a4438d
- **Region**: EEUR (Eastern Europe)
- **Binding**: DB

### Run Migrations
```bash
# Local database
npm run db:migrate

# Production database
npm run db:migrate:prod
```

## API Testing

### Authentication
API Key: `tk_6fcc606ac191247d72dce700110cf77a`

### Test Endpoints

**List Tasks:**
```bash
curl https://taskinfa-kanban.secan-ltd.workers.dev/api/tasks \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a"
```

**Create Task:**
```bash
curl -X POST https://taskinfa-kanban.secan-ltd.workers.dev/api/tasks \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test task",
    "priority": "high"
  }'
```

**Update Task:**
```bash
curl -X PATCH https://taskinfa-kanban.secan-ltd.workers.dev/api/tasks/task_3 \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

## Local Development

### Run Dev Server
```bash
npm run dev
# Access at http://localhost:3000
```

### Preview Production Build
```bash
npm run preview
# Builds with OpenNext and runs locally with Workers runtime
```

## Deployment Details

**Account ID**: 431b4bb41db98a5f443958685626ac7d
**Worker Name**: taskinfa-kanban
**Worker ID**: 7f48fb58-ac03-4a4a-bfd9-23dfeddd81b1

### Current Bindings
- `env.DB` → D1 Database (taskinfa-kanban-db)
- `env.ASSETS` → Static Assets
- `env.NEXTJS_ENV` → "production"
- `env.JWT_SECRET` → Worker Secret

## Monitoring

### View Logs
```bash
npx wrangler tail --format=pretty
```

### Check Metrics
Visit: https://dash.cloudflare.com/431b4bb41db98a5f443958685626ac7d/workers/services/view/taskinfa-kanban

## Comparison: Pages vs Workers

| Feature | Pages (Old) | Workers (New) |
|---------|-------------|---------------|
| Runtime | Edge only | Node.js + Edge |
| Next.js Features | Limited | Full support |
| D1 Bindings | Complex | Native |
| API Routes | Requires edge runtime | Standard routes work |
| Image Optimization | No | Yes |
| ISR | No | Yes |
| Maintenance | Deprecated adapter | Actively maintained |
| Performance | Good | Excellent |

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next .open-next node_modules
npm install
npm run build
npx opennextjs-cloudflare build
```

### Deployment Issues
```bash
# Check wrangler authentication
npx wrangler whoami

# Verify D1 database
npx wrangler d1 list

# Test local build
npm run preview
```

### Database Errors
```bash
# Check D1 connection
npx wrangler d1 execute taskinfa-kanban-db --remote --command "SELECT 1"

# Verify binding in wrangler.jsonc
cat wrangler.jsonc | grep -A 5 "d1_databases"
```

## Next Steps

1. ✅ **Test API**: Verify all endpoints work correctly
2. ✅ **Set JWT Secret**: Configured as Worker secret
3. ⏳ **Test Dashboard**: Fix homepage 500 error
4. ⏳ **Connect Bot**: Configure bot to use Workers deployment
5. ⏳ **Monitor Performance**: Check metrics in Cloudflare dashboard

## Resources

- [OpenNext Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Next.js on Workers Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [GitHub: opennextjs/opennextjs-cloudflare](https://github.com/opennextjs/opennextjs-cloudflare)

---

**Last Updated**: 2026-01-26
**Status**: ✅ Deployed to Workers
**URL**: https://taskinfa-kanban.secan-ltd.workers.dev
