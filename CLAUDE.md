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

### ⚠️ IMPORTANT: We Deploy to Cloudflare Workers (NOT Pages)

**DO NOT USE:** `wrangler pages deploy` ❌
**ALWAYS USE:** `wrangler deploy` ✅

We deploy directly to **Cloudflare Workers** at:
- **Production URL:** https://taskinfa-kanban.secan-ltd.workers.dev

### Deployment Architecture

```
Next.js App → OpenNext.js Build → Cloudflare Workers
             (@cloudflare/next-on-pages)
```

**Key Components:**
- **Worker Script:** `.vercel/output/static/_worker.js/index.js` (main entry point)
- **Static Assets:** `.vercel/output/static/` (served via ASSETS binding)
- **Database:** D1 (bound as "DB")

### Build & Deploy Process

**Step 1: Build with OpenNext.js**
```bash
cd packages/dashboard
npx @cloudflare/next-on-pages
```

This creates:
- Worker code at `.vercel/output/static/_worker.js/`
- Static assets in `.vercel/output/static/`

**Step 2: Deploy to Workers**
```bash
npx wrangler deploy
```

**DO NOT run:** `wrangler pages deploy` (deploys to Pages, not Workers)

### wrangler.toml Configuration

**Correct Configuration for Workers:**
```toml
name = "taskinfa-kanban"
main = ".vercel/output/static/_worker.js/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# ASSETS binding for static files
[assets]
directory = ".vercel/output/static"
binding = "ASSETS"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "taskinfa-kanban-db"
database_id = "e2f4e8ae-71a3-4234-8db1-3abda4a4438d"
```

**Key Points:**
- `main` = Worker entry point (required for Workers deployment)
- `[assets]` = ASSETS binding (static files served by worker)
- NO `pages_build_output_dir` (that's for Pages, not Workers)

### .assetsignore File

Create `.vercel/output/static/.assetsignore` to exclude worker code from assets:
```
_worker.js
_worker.js/*
```

### Environment Variables

Set in Cloudflare Workers dashboard (not Pages):
1. Go to Workers & Pages → taskinfa-kanban → Settings → Variables
2. Add environment variables:
   - `JWT_SECRET` (required)
   - `SESSION_SECRET` (required)
   - `BCRYPT_ROUNDS` (optional, defaults to 12)
   - `SESSION_MAX_AGE` (optional, defaults to 604800)

### Database Migrations

**Local Database:**
```bash
npx wrangler d1 execute taskinfa-kanban-db --local \
  --file=./migrations/003_add_users.sql
```

**Production Database:**
```bash
npx wrangler d1 execute taskinfa-kanban-db --remote \
  --file=./migrations/003_add_users.sql
```

### Deployment Checklist

**Before Deploying:**
- [ ] Test in local environment with `npm run dev`
- [ ] Build successfully with `npx @cloudflare/next-on-pages`
- [ ] Run database migrations (if needed)
- [ ] Verify environment variables are set in Workers dashboard
- [ ] Check `.assetsignore` exists in `.vercel/output/static/`

**Deploy:**
```bash
# Build
npx @cloudflare/next-on-pages

# Deploy to Workers (NOT Pages!)
npx wrangler deploy
```

**Verify:**
- [ ] Visit https://taskinfa-kanban.secan-ltd.workers.dev
- [ ] Check bindings in Workers dashboard (ASSETS + DB)
- [ ] Test signup/login functionality
- [ ] Test API endpoints

### Common Mistakes to Avoid

❌ **WRONG:** Using `wrangler pages deploy`
- This deploys to Cloudflare Pages (*.pages.dev URLs)
- Creates a separate Pages project
- Doesn't use your Workers configuration

✅ **CORRECT:** Using `wrangler deploy`
- Deploys to Cloudflare Workers (*.workers.dev URL)
- Uses bindings from wrangler.toml (ASSETS + D1)
- Matches your production environment

❌ **WRONG:** Adding `pages_build_output_dir` to wrangler.toml
- Makes wrangler think this is a Pages project

✅ **CORRECT:** Using `main` and `[assets]` in wrangler.toml
- Configures proper Workers deployment with ASSETS binding

### Troubleshooting

**Error: "It looks like you've run a Workers-specific command in a Pages project"**
- Check wrangler.toml has `main` (not `pages_build_output_dir`)
- Remove any Pages-specific configuration

**Error: "Uploading a Pages _worker.js directory as an asset"**
- Create `.assetsignore` file in `.vercel/output/static/`
- Add `_worker.js` and `_worker.js/*` to ignore list

**Bindings not working:**
- Verify `[assets]` section exists in wrangler.toml
- Check D1 database ID matches production database
- Confirm environment variables are set in Workers dashboard (not Pages)

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
