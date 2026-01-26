# Taskinfa-Kanban Deployment Information

## 🚀 Live Deployment

**Production URL**: https://taskinfa-kanban.pages.dev
**Latest Deployment**: https://9f12d74b.taskinfa-kanban.pages.dev

## 🗄️ Database

**D1 Database Name**: taskinfa-kanban-db
**Database ID**: `e2f4e8ae-71a3-4234-8db1-3abda4a4438d`
**Region**: EEUR (Eastern Europe)
**Tables**: 3 (workspaces, tasks, api_keys)
**Sample Data**: ✅ Populated with 4 test tasks

### Database Status
- ✅ Local database migrated
- ✅ Remote database migrated
- ✅ Indexed for performance
- ✅ Sample workspace and tasks created

## 🔐 Authentication

### JWT Secret
```
8306b2e1f3583e2fc2f12963a7b419276b34293071193da8151d32a6954e454a
```
**Status**: ✅ Set in Cloudflare Pages secrets

### API Key
```
API Key: tk_6fcc606ac191247d72dce700110cf77a
Key Hash: 09e2058319ddae23b1627030b05bbb6b55ee71f21699985087f1ba91aff25ad0
```
**Status**: ✅ Stored in both local and remote D1 databases
**Workspace**: default
**Name**: Development Key

## 📋 Sample Tasks

| ID | Title | Status | Priority |
|----|-------|--------|----------|
| task_1 | Setup project structure | done | high |
| task_2 | Create database schema | done | high |
| task_3 | Build kanban UI | todo | medium |
| task_4 | Implement MCP server | todo | high |

## 🔧 Configuration

### Environment Variables
```bash
# Dashboard (Cloudflare Pages Secret)
JWT_SECRET=8306b2e1f3583e2fc2f12963a7b419276b34293071193da8151d32a6954e454a

# Bot (Local .env)
TASKINFA_API_KEY=tk_6fcc606ac191247d72dce700110cf77a
TASKINFA_WORKSPACE=default
```

### Wrangler Configuration
- **Project Name**: taskinfa-kanban
- **Production Branch**: main
- **Database Binding**: DB
- **Compatibility Date**: 2024-01-01

## 🧪 Testing API

### List Tasks
```bash
curl https://taskinfa-kanban.pages.dev/api/tasks \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a"
```

### Get Single Task
```bash
curl https://taskinfa-kanban.pages.dev/api/tasks/task_3 \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a"
```

### Create Task
```bash
curl -X POST https://taskinfa-kanban.pages.dev/api/tasks \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test task from API",
    "description": "Testing the API endpoint",
    "priority": "high",
    "labels": ["test", "api"]
  }'
```

### Update Task Status
```bash
curl -X PATCH https://taskinfa-kanban.pages.dev/api/tasks/task_3 \
  -H "Authorization: Bearer tk_6fcc606ac191247d72dce700110cf77a" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

## 🤖 Bot Configuration

To connect Claude Code bot to the deployed dashboard:

### Option 1: REST API
```bash
# Set environment variables
export TASKINFA_API_KEY=tk_6fcc606ac191247d72dce700110cf77a
export TASKINFA_API_URL=https://taskinfa-kanban.pages.dev

# Run bot
cd packages/bot
npm start -- run --workspace=default
```

### Option 2: MCP Server (Local)
```bash
# The MCP server runs locally and connects to remote D1
cd packages/dashboard
node dist/lib/mcp/server.js

# In another terminal, run bot
cd packages/bot
npm start -- run \
  --workspace=default \
  --server=node \
  --args="packages/dashboard/dist/lib/mcp/server.js"
```

## 📊 Cloudflare Dashboard

**Account ID**: 431b4bb41db98a5f443958685626ac7d
**Pages Project**: [View Dashboard](https://dash.cloudflare.com/431b4bb41db98a5f443958685626ac7d/pages/view/taskinfa-kanban)
**D1 Databases**: [View Databases](https://dash.cloudflare.com/431b4bb41db98a5f443958685626ac7d/workers/d1)

## 🔄 Deployment Commands

### Deploy to Pages
```bash
cd packages/dashboard
npm run build
npx wrangler pages deployment create --project-name=taskinfa-kanban --branch=main .next/
```

### Update D1 Database
```bash
# Local
npx wrangler d1 execute taskinfa-kanban-db --file=./schema.sql

# Remote
npx wrangler d1 execute taskinfa-kanban-db --remote --file=./schema.sql
```

### Set Secrets
```bash
echo "SECRET_VALUE" | npx wrangler pages secret put SECRET_NAME --project-name=taskinfa-kanban
```

## ⚠️ Important Notes

### D1 Binding Issue
Currently, the D1 database binding may not work automatically with Pages deployments. You may need to:

1. Configure D1 binding in Cloudflare dashboard:
   - Go to Pages project settings
   - Navigate to "Functions" tab
   - Add D1 database binding: `DB` → `taskinfa-kanban-db`

2. Or use Cloudflare Workers for better D1 integration

### Next.js on Cloudflare Pages
The current deployment uses standard Next.js build. For better Cloudflare compatibility:
- Consider using `@cloudflare/next-on-pages` adapter (currently deprecated)
- Or migrate to Cloudflare Workers + Pages Functions
- Or use OpenNext adapter for Cloudflare

## 🐛 Troubleshooting

### API Returns 500 Error
- Check if D1 binding is configured in Pages dashboard
- Verify JWT_SECRET is set correctly
- Check deployment logs in Cloudflare dashboard

### Database Connection Failed
- Ensure D1 database ID in wrangler.toml is correct
- Verify bindings are configured in Pages settings
- Try redeploying after fixing configuration

### Authentication Failed
- Verify API key matches the hash in database
- Check if JWT_SECRET is set correctly
- Ensure Authorization header format: `Bearer <token>`

## 📝 Next Steps

1. **Test Dashboard**: Visit https://taskinfa-kanban.pages.dev
2. **Configure D1 Binding**: Add DB binding in Cloudflare dashboard if needed
3. **Test API**: Try the curl commands above
4. **Run Bot Locally**: Connect bot to deployed API
5. **Monitor**: Check Cloudflare dashboard for logs and metrics

---

**Last Updated**: 2026-01-26 15:44 UTC
**Deployment**: Production
**Status**: ✅ Active
