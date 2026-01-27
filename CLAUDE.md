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

## MCP Server Development

### Tool Definitions
- Keep tool names lowercase with underscores
- Provide clear descriptions
- Document all parameters
- Include examples in comments

### Error Handling
- Return structured error messages
- Use `isError: true` for failures
- Log errors for debugging

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

## Bot Development

### Execution Loop
- Respect circuit breaker limits
- Log progress clearly
- Handle Claude Code timeouts gracefully
- Clean up resources on exit

### Configuration
- Use environment variables for secrets
- Provide sensible defaults
- Validate configuration on startup

## Testing

### Unit Tests (To Be Implemented)
- Test individual functions in isolation
- Mock external dependencies
- Use descriptive test names

### Integration Tests (To Be Implemented)
- Test API endpoints end-to-end
- Test MCP server tools
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

**Production URL:** https://taskinfa-kanban.secan-ltd.workers.dev

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

### Quick Deploy Command

```bash
cd packages/dashboard
npm run deploy:prod
```

This script does:
1. Build Next.js app
2. Generate OpenNext bundle
3. Deploy to Cloudflare Workers

### Manual Deployment Steps

If you need to deploy manually:

```bash
cd packages/dashboard

# Step 1: Build and generate OpenNext bundle
npx opennextjs-cloudflare build

# Step 2: Deploy to Workers
npx opennextjs-cloudflare deploy
```

### Configuration Files

#### 1. wrangler.toml

```toml
name = "taskinfa-kanban"
main = ".open-next/worker.js"
compatibility_date = "2026-01-16"
compatibility_flags = ["nodejs_compat"]

# ASSETS binding for static files (CSS, JS, images)
[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-db"
database_id = "e2f4e8ae-71a3-4234-8db1-3abda4a4438d"
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
    "deploy:prod": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "db:migrate": "wrangler d1 execute taskinfa-kanban-db --local --file=./migrations/003_add_users.sql",
    "db:migrate:prod": "wrangler d1 execute taskinfa-kanban-db --remote --file=./migrations/003_add_users.sql"
  }
}
```

### Environment Variables

Set in Cloudflare Workers dashboard:

1. Go to: **Workers & Pages** → **taskinfa-kanban** → **Settings** → **Variables**
2. Add these secrets:
   - `JWT_SECRET` (required) - 256-bit secret key
   - `SESSION_SECRET` (optional, falls back to JWT_SECRET)
   - `BCRYPT_ROUNDS` (optional, default: 12)
   - `SESSION_MAX_AGE` (optional, default: 604800)

### Database Migrations

**Local Database:**
```bash
npm run db:migrate
# or
npx wrangler d1 execute taskinfa-kanban-db --local \
  --file=./migrations/003_add_users.sql
```

**Production Database:**
```bash
npm run db:migrate:prod
# or
npx wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/003_add_users.sql
```

### Deployment Checklist

**Before Deploying:**
- [ ] All changes committed to git
- [ ] `open-next.config.ts` exists with correct config
- [ ] `wrangler.toml` points to `.open-next/` (not `.vercel/`)
- [ ] No `export const runtime = 'edge';` in route files
- [ ] Environment variables set in Workers dashboard
- [ ] Database migrations applied (if needed)

**Deploy:**
```bash
cd packages/dashboard
npm run deploy:prod
```

**Verify:**
- [ ] Visit https://taskinfa-kanban.secan-ltd.workers.dev
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

**Last Updated:** January 27, 2026
**Project:** Taskinfa-Bot
**Repository:** https://github.com/secanltd/taskinfa-kanban
**Production URL:** https://taskinfa-kanban.secan-ltd.workers.dev
