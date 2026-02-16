# Claude Code Project Rules

This file contains project-specific rules and conventions for Claude Code when working on this repository.

## Git Commit Messages

### ❌ NEVER Add Co-Authored-By Lines
Do NOT add "Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>" or similar attribution lines to commit messages.

**Incorrect:**
```
git commit -m "Add feature

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Correct:**
```
git commit -m "Add feature

Detailed description of changes..."
```

### Commit Message Format
Follow Conventional Commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build/tooling changes

**Example:**
```
feat: Add task filtering by priority

- Implement priority filter in API endpoint
- Add UI dropdown for priority selection
- Update tests for new filtering logic
```

## Code Style

### TypeScript
- Use explicit types, avoid `any` where possible
- Export types from shared package
- Use async/await over raw Promises
- Handle errors with try/catch blocks

### React Components
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript interfaces for props

### File Organization
- Keep related files together
- Use index.ts for clean exports
- Avoid deep nesting (max 3-4 levels)

## Development Workflow

### ❌ NEVER Push Directly to Main
The `main` branch is **protected**. Direct pushes will be rejected.

### Commit Workflow (ALWAYS follow this)
When asked to commit changes:
1. Create a feature branch from the current branch (e.g. `fix/short-description` or `feat/short-description`)
2. Commit the changes on that branch
3. Push the branch with `-u`
4. Output the GitHub PR creation URL so the user can open a PR

```bash
git checkout -b feat/my-change
git add <files>
git commit -m "feat: My change"
git push -u origin feat/my-change
# Then output: https://github.com/secanltd/taskinfa-kanban/compare/feat/my-change?expand=1
```

### Before Committing
1. Test changes locally
2. Run linter: `npm run lint`
3. Verify builds: `npm run build`
4. Check for console errors

### When Adding Features
1. Update relevant documentation
2. Add TypeScript types to shared package
3. Update API documentation if endpoints change
4. Consider backward compatibility

### When Fixing Bugs
1. Understand root cause before fixing
2. Add tests to prevent regression
3. Update documentation if behavior changes

## Database Changes

### D1 Migrations
- Always create migration SQL files
- Test migrations locally first
- Document schema changes in comments
- Never delete migration files

**Example:**
```sql
-- Migration: Add task tags feature
-- Date: 2025-01-26

ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';
CREATE INDEX idx_tasks_tags ON tasks(tags);
```

## V2 Architecture

### Components
1. **Dashboard** (packages/dashboard) — Next.js on CF Workers, kanban board + overview + sessions panel
2. **Telegram Bot** (packages/telegram) — CF Worker, shares D1 database, /status /tasks /new commands
3. **Orchestrator** (scripts/orchestrator.ts) — Node.js daemon, polls API every 15min, starts Claude sessions
4. **Claude Hooks** (.claude/settings.json) — auto-POST status events to /api/events

### Key API Routes
- `POST /api/events` — accepts events from Claude hooks, triggers Telegram notifications
- `GET/POST /api/sessions` — CRUD for Claude Code sessions
- `GET/PATCH /api/sessions/[id]` — individual session management
- `GET/POST /api/tasks` — existing task CRUD
- `GET /overview` — global project status page

### Database Tables (migration 006)
- `sessions` — tracks Claude Code sessions (replaces workers)
- `session_events` — event stream from Claude hooks
- `notification_config` — per-workspace Telegram settings

### Memory System
- `/workspace/.memory/overview.md` — cross-project state
- `/workspace/.memory/preferences.md` — user conventions
- `/workspace/<project>/.memory/context.md` — per-project state

## API Development

### REST Endpoints
- Use RESTful conventions
- Return consistent JSON format
- Always validate input
- Include proper HTTP status codes

### Authentication
- Verify JWT on all protected routes
- Check workspace_id matches user's access
- Log authentication failures

## Orchestrator

### Configuration (Environment Variables)
- `KANBAN_API_URL` — Dashboard API base URL
- `KANBAN_API_KEY` — API key (Bearer token)
- `POLL_INTERVAL` — ms between polls (default 900000 = 15min)
- `MAX_CONCURRENT` — max parallel Claude sessions (default 3)
- `MAX_RETRIES` — retries before marking task blocked (default 3)

### Running
```bash
npm run orchestrator                    # direct
pm2 start scripts/orchestrator.ts       # with pm2
```

## Testing

### Unit Tests (To Be Implemented)
- Test individual functions in isolation
- Mock external dependencies
- Use descriptive test names

### Integration Tests (To Be Implemented)
- Test API endpoints end-to-end
- Test database operations

## Documentation

### Code Comments
- Explain WHY, not WHAT
- Document complex algorithms
- Add JSDoc for exported functions
- Keep comments up-to-date

### README Updates
- Keep README in sync with features
- Update examples when APIs change
- Document breaking changes clearly

## Security

### Never Commit
- API keys or secrets
- Database credentials
- JWT secrets
- Personal information

### Best Practices
- Hash API keys before storing
- Use environment variables
- Validate all user input
- Sanitize SQL queries (use parameterized queries)

## Performance

### Database
- Use indexes for frequent queries
- Limit query results
- Cache when appropriate
- Monitor query performance

### Frontend
- Lazy load components when possible
- Optimize bundle size
- Use React.memo for expensive components
- Minimize re-renders

## Deployment

### ⚠️ CRITICAL: We Deploy to Cloudflare Workers Using @opennextjs/cloudflare

**🚫 DO NOT USE (DEPRECATED):**
- `@cloudflare/next-on-pages` ❌ (deprecated in 2026)
- `wrangler pages deploy` ❌ (deploys to Pages, not Workers)

**✅ ALWAYS USE:**
- `@opennextjs/cloudflare` ✅ (official OpenNext adapter for Workers)
- `npm run deploy:prod` ✅ (our deployment script)

**Test URL:** https://taskinfa-kanban-test.secan-ltd.workers.dev
**Production URL:** https://taskinfa-kanban-prod.secan-ltd.workers.dev

### Why @opennextjs/cloudflare?

In 2026, Cloudflare deprecated `@cloudflare/next-on-pages` and recommends using `@opennextjs/cloudflare` instead:

- ✅ **Node.js Runtime** - Full Node.js API support (vs Edge Runtime limitations)
- ✅ **Better Feature Support** - More Next.js features work out of the box
- ✅ **Official Support** - Maintained by the OpenNext team with Cloudflare
- ✅ **No Edge Runtime Required** - Use standard Next.js routes

### Deployment Architecture

```
Next.js App → @opennextjs/cloudflare build → Cloudflare Workers
             (opennextjs-cloudflare CLI)
```

**Build Output:**
- **Worker Script:** `.open-next/worker.js` (main entry point)
- **Static Assets:** `.open-next/assets/` (served via ASSETS binding)
- **Database:** D1 (bound as "DB")

### CI/CD Pipeline (GitHub Actions)

Deployments are triggered by git tags:

```bash
# Deploy to test
git tag deploy/test/1.0.1 && git push origin deploy/test/1.0.1

# Deploy to production
git tag deploy/prod/1.0.1 && git push origin deploy/prod/1.0.1
```

CI runs lint + build on every PR to `main` (`.github/workflows/ci.yml`).
Deploy workflow (`.github/workflows/deploy.yml`) triggers on `deploy/test/*` and `deploy/prod/*` tags.

### Quick Deploy Commands (local)

```bash
cd packages/dashboard

# Deploy to test environment
npm run deploy:test

# Deploy to production environment
npm run deploy:prod
```

### Configuration Files

#### 1. wrangler.toml

```toml
# Base config (local dev)
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
database_id = "e2f4e8ae-71a3-4234-8db1-3abda4a4438d"

# ─── Test Environment ───
[env.test]
name = "taskinfa-kanban-test"

[[env.test.d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-test-db"
database_id = "9cb1ec07-b3ad-43a6-9795-644041818682"

# ─── Production Environment ───
[env.production]
name = "taskinfa-kanban-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-prod-db"
database_id = "5ee95f43-c3a7-4d44-9d7f-12cb878b49c9"
```

**Critical Requirements:**
- `main` must point to `.open-next/worker.js` (not `.vercel/...`)
- `compatibility_flags` must include `["nodejs_compat"]`
- `compatibility_date` must be `2026-01-16` or later
- `[assets]` directory must be `.open-next/assets` (not `.vercel/...`)

#### 2. open-next.config.ts

```typescript
import type { OpenNextConfig } from '@opennextjs/cloudflare';

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy',
    },
  },
  edgeExternals: ['node:crypto'],
  middleware: {
    external: true,
    override: {
      wrapper: 'cloudflare-edge',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy',
    },
  },
};

export default config;
```

**This file is required** for `@opennextjs/cloudflare` to work.

#### 3. package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:worker": "opennextjs-cloudflare build",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy:test": "opennextjs-cloudflare build && opennextjs-cloudflare deploy --env test",
    "deploy:prod": "opennextjs-cloudflare build && opennextjs-cloudflare deploy --env production",
    "db:migrate": "wrangler d1 migrations apply taskinfa-kanban-db --local",
    "db:migrate:test": "wrangler d1 migrations apply taskinfa-kanban-test-db --remote",
    "db:migrate:prod": "wrangler d1 migrations apply taskinfa-kanban-prod-db --remote",
    "db:migrations:list": "wrangler d1 migrations list taskinfa-kanban-db --local",
    "db:migrations:list:test": "wrangler d1 migrations list taskinfa-kanban-test-db --remote",
    "db:migrations:list:prod": "wrangler d1 migrations list taskinfa-kanban-prod-db --remote",
    "db:migrations:create": "wrangler d1 migrations create taskinfa-kanban-db"
  }
}
```

**⚠️ IMPORTANT:** Use `migrations apply` (tracks migrations in `d1_migrations` table), NOT `execute --file` (doesn't track).

### Environment Variables

Set secrets per environment using wrangler CLI:

```bash
# Test
wrangler secret put JWT_SECRET --env test
wrangler secret put SESSION_SECRET --env test

# Production
wrangler secret put JWT_SECRET --env production
wrangler secret put SESSION_SECRET --env production
```

Required secrets:
- `JWT_SECRET` (required) - 256-bit secret key
- `SESSION_SECRET` (optional, falls back to JWT_SECRET)

GitHub repository secrets (for CI/CD):
- `CLOUDFLARE_API_TOKEN` - API token with "Edit Cloudflare Workers" permissions
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

### Database Migrations

**⚠️ CRITICAL: Always use `migrations apply` to track which migrations have been applied.**

D1 tracks migrations in the `d1_migrations` table. Using `execute --file` bypasses tracking and can lead to duplicate migrations.

#### Creating a New Migration

```bash
cd packages/dashboard

# Create new migration file
npm run db:migrations:create -- add_task_tags

# This creates: migrations/YYYYMMDDHHMMSS_add_task_tags.sql
```

#### Applying Migrations Locally

```bash
cd packages/dashboard

# Apply all pending migrations
npm run db:migrate

# List applied migrations
npm run db:migrations:list
```

#### Applying to Test/Production

**❌ DO NOT run migrations manually in test/production!** Use the CI/CD workflow:

```bash
# 1. Test your migration locally first
npm run db:migrate

# 2. Commit and push the migration file
git add packages/dashboard/migrations/
git commit -m "feat: add task tags migration"
git push origin main

# 3. Tag for test migration
git tag migratedb/test/v2.3.0
git push origin migratedb/test/v2.3.0

# 4. GitHub Actions will automatically apply migrations to test DB
# Watch: https://github.com/secanltd/taskinfa-kanban/actions

# 5. After testing, tag for production migration
git tag migratedb/prod/v2.3.0
git push origin migratedb/prod/v2.3.0
```

#### Manual Migration (Emergency Only)

If you MUST run migrations manually (not recommended):

```bash
cd packages/dashboard

# Test database
npm run db:migrate:test

# Production database (DANGEROUS!)
npm run db:migrate:prod

# List applied migrations
npm run db:migrations:list:prod
```

#### Migration Best Practices

1. **Always create migrations with wrangler** - ensures proper naming
2. **Test locally first** - run `npm run db:migrate` before pushing
3. **Use CI/CD for test/prod** - prevents human error
4. **Never delete migration files** - D1 tracks them
5. **Document schema changes** - add SQL comments
6. **One change per migration** - easier to rollback

#### Migration Workflow Example

```sql
-- Migration: Add task tags feature
-- Date: 2026-02-17
-- Author: Your Name

-- Add tags column to tasks table
ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';

-- Create index for tag searches
CREATE INDEX idx_tasks_tags ON tasks(tags);

-- Add comment explaining the feature
-- Tags are stored as JSON array: ["bug", "feature", "urgent"]
```

### Deployment Checklist

**Before Deploying:**
- [ ] All changes committed to git
- [ ] `open-next.config.ts` exists with correct config
- [ ] `wrangler.toml` points to `.open-next/` (not `.vercel/`)
- [ ] No `export const runtime = 'edge';` in route files
- [ ] Environment variables set in Workers dashboard
- [ ] Database migrations applied (if needed)

**Deploy (via tag):**
```bash
git tag deploy/test/1.0.0 && git push origin deploy/test/1.0.0   # test
git tag deploy/prod/1.0.0 && git push origin deploy/prod/1.0.0   # production
```

**Verify:**
- [ ] Visit https://taskinfa-kanban-test.secan-ltd.workers.dev (test)
- [ ] Visit https://taskinfa-kanban-prod.secan-ltd.workers.dev (prod)
- [ ] Check bindings in dashboard: `env.DB` (D1) + `env.ASSETS`
- [ ] Test signup/login functionality
- [ ] Check browser console for errors

### CRITICAL: Don't Use Edge Runtime

❌ **DO NOT add this to route files:**
```typescript
export const runtime = 'edge';  // ❌ WRONG for @opennextjs/cloudflare
```

✅ **Correct approach:**
```typescript
// No runtime export needed!
// @opennextjs/cloudflare uses Node.js runtime automatically
export async function POST(request: NextRequest) {
  // Your code here
}
```

### Common Mistakes to Avoid

#### ❌ Using Deprecated Package
```bash
# WRONG - deprecated package
npm install @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
wrangler pages deploy .vercel/output/static
```

#### ✅ Using Current Package
```bash
# CORRECT - current package
npm install @opennextjs/cloudflare
npm run deploy:prod
```

#### ❌ Wrong Build Output Paths
```toml
# WRONG - old paths from deprecated package
main = ".vercel/output/static/_worker.js/index.js"
[assets]
directory = ".vercel/output/static"
```

#### ✅ Correct Build Output Paths
```toml
# CORRECT - paths for @opennextjs/cloudflare
main = ".open-next/worker.js"
[assets]
directory = ".open-next/assets"
```

#### ❌ Adding Edge Runtime Exports
```typescript
// WRONG - breaks @opennextjs/cloudflare
export const runtime = 'edge';
```

#### ✅ No Runtime Export
```typescript
// CORRECT - use default Node.js runtime
// (no export needed)
```

### Troubleshooting

**Error: "Cannot find package '@cloudflare/next-on-pages'"**
- ✅ Solution: This package is deprecated. Remove it and use `@opennextjs/cloudflare` instead
- Run: `npm uninstall @cloudflare/next-on-pages && npm install @opennextjs/cloudflare`

**Error: "app/api/auth/login/route cannot use the edge runtime"**
- ✅ Solution: Remove all `export const runtime = 'edge';` from your route files
- `@opennextjs/cloudflare` uses Node.js runtime, not Edge runtime

**Error: "Missing required open-next.config.ts file"**
- ✅ Solution: Create `open-next.config.ts` in project root with proper configuration
- See configuration example above

**Error: "D1 database binding not found"**
- ✅ Check `wrangler.toml` has correct D1 binding configuration
- ✅ Verify `compatibility_flags` includes `["nodejs_compat"]`
- ✅ Check `compatibility_date` is `2026-01-16` or later

**Bindings not working:**
- ✅ Check deployment logs show: `env.DB (taskinfa-kanban-db)` and `env.ASSETS`
- ✅ Verify wrangler.toml has correct `[assets]` and `[[d1_databases]]` sections
- ✅ Ensure environment variables are set in **Workers** dashboard (not Pages)

### Migration from Old System

If you previously used `@cloudflare/next-on-pages`:

1. **Uninstall deprecated package:**
   ```bash
   npm uninstall @cloudflare/next-on-pages
   ```

2. **Install new package:**
   ```bash
   npm install @opennextjs/cloudflare wrangler@latest esbuild
   ```

3. **Update wrangler.toml:**
   - Change `main` from `.vercel/output/static/_worker.js/index.js` to `.open-next/worker.js`
   - Change `[assets] directory` from `.vercel/output/static` to `.open-next/assets`
   - Update `compatibility_date` to `2026-01-16` or later

4. **Create open-next.config.ts** (see example above)

5. **Remove Edge Runtime exports:**
   ```bash
   find src/app -type f \( -name "*.tsx" -o -name "route.ts" \) \
     -exec sed -i '' '/^export const runtime = .edge.;$/d' {} \;
   ```

6. **Update .gitignore:**
   - Replace `.vercel/` with `.open-next/`

7. **Deploy:**
   ```bash
   npm run deploy:prod
   ```

## Repository Conventions

### Branch Naming
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

### Pull Requests
- Provide clear description
- Link related issues
- Request reviews when needed
- Update documentation

## Support and Maintenance

### Issue Tracking
- Use GitHub Issues for bugs and features
- Provide reproduction steps
- Include environment details
- Tag appropriately

### Versioning
- Follow Semantic Versioning (SemVer)
- Document changes in releases
- Update package.json versions
- Tag releases in git

---

**Last Updated:** February 11, 2026
**Project:** Taskinfa Kanban v2
**Repository:** https://github.com/secanltd/taskinfa-kanban
**Test URL:** https://taskinfa-kanban-test.secan-ltd.workers.dev
**Production URL:** https://taskinfa-kanban-prod.secan-ltd.workers.dev
