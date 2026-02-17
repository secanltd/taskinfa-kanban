# Taskinfa Kanban — Claude Code Rules

Repository: https://github.com/secanltd/taskinfa-kanban
> For history and past decisions: `git log --oneline`

---

## Local Development

Start everything with one command:
```bash
git pull origin main && ./dev.sh
```

`dev.sh` does the following automatically:
- Resets and re-migrates the local D1 database on every fresh start
- Seeds a dev user and generates a fresh API key
- Writes the API key + local URL into root `.env` for the orchestrator
- Starts the Next.js dashboard (port 3000) and the orchestrator (polls every 10s)
- Prints all credentials, config paths, and log commands at the end

Dev user credentials (seeded fresh each run):
- Email: `dev@taskinfa.local`
- Password: `DevPass123!`

Skip the orchestrator if you only need the UI:
```bash
./dev.sh --no-orchestrator
```

---

## Architecture

```
packages/dashboard   — Next.js app, deployed to Cloudflare Workers via @opennextjs/cloudflare
packages/telegram    — Cloudflare Worker, Telegram bot, shares the same D1 database
scripts/orchestrator.ts — Node.js daemon, polls /api/tasks, spawns Claude Code sessions
.claude/settings.json   — Claude hooks: POSTs events to /api/events on session state changes
```

Key API routes:
- `POST /api/events` — receives Claude hook events, triggers Telegram notifications
- `GET/POST /api/tasks` — task CRUD
- `GET/POST /api/sessions` — Claude session tracking
- `GET/POST /api/keys` — API key management
- `GET /overview` — global project status

Database tables of note: `tasks`, `sessions`, `session_events`, `api_keys`, `users`, `workspaces`

Orchestrator env vars (written to `.env` by `dev.sh`; set manually for prod):
- `KANBAN_API_URL` — dashboard base URL
- `KANBAN_API_KEY` — Bearer token
- `POLL_INTERVAL` — ms between polls (10000 locally, 900000 in prod)
- `MAX_CONCURRENT` — max parallel Claude sessions (default 3)

---

## Git Rules

**NEVER push directly to `main` — it is protected.**

When asked to commit:
1. Create a branch: `feat/short-name` or `fix/short-name`
2. Commit on that branch
3. Push with `-u`
4. Output the PR URL: `https://github.com/secanltd/taskinfa-kanban/compare/<branch>?expand=1`

**NEVER add Co-Authored-By lines to commits.**

Commit format — Conventional Commits:
```
feat: add priority filter to task list

- filter applied in GET /api/tasks
- UI dropdown in kanban header
```
Prefixes: `feat` `fix` `docs` `refactor` `test` `chore`

Branch naming: `feat/` `fix/` `docs/` `refactor/`

---

## Database Migrations

Always use `migrations apply` — never `execute --file` (bypasses tracking).

```bash
# Create
cd packages/dashboard && npm run db:migrations:create -- describe_change

# Test locally (dev.sh already does this on startup)
npm run db:migrate

# Deploy to test/prod via CI — push a tag:
git tag migratedb/test/vX.Y.Z && git push origin migratedb/test/vX.Y.Z
git tag migratedb/prod/vX.Y.Z && git push origin migratedb/prod/vX.Y.Z
```

Never delete migration files. One change per migration. Document with SQL comments.

---

## Deployment

We use `@opennextjs/cloudflare` — **not** the deprecated `@cloudflare/next-on-pages`.

Deploy via CI by pushing a tag (never deploy manually unless emergency):
```bash
git tag deploy/test/X.Y.Z && git push origin deploy/test/X.Y.Z
git tag deploy/prod/X.Y.Z && git push origin deploy/prod/X.Y.Z
```

URLs:
- Test: https://taskinfa-kanban-test.secan-ltd.workers.dev
- Prod: https://taskinfa-kanban-prod.secan-ltd.workers.dev

Critical rules for route files — **do not add** `export const runtime = 'edge'`. The Workers adapter uses Node.js runtime automatically. Build output goes to `.open-next/`, not `.vercel/`.

Required Worker secrets (set via `wrangler secret put <KEY> --env <test|production>`):
- `JWT_SECRET`

---

## Code Style

- TypeScript: explicit types, no `any`, `async/await`, `try/catch`
- React: functional components, hooks, small focused components, interfaces for props
- Types shared via `packages/shared` — export from there, not inline
- Never commit secrets, credentials, or `.env` files
- SQL: always use parameterized queries
