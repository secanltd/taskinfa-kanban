# Taskinfa Kanban — Claude Code Rules

Repository: https://github.com/secanltd/taskinfa-kanban
> For history and past decisions: `git log --oneline`

Full rules: `.claude/rules/` — git-workflow, database, deployment, orchestrator, code-style

---

## Local Development

```bash
git pull origin main && ./dev.sh
```

Dev user: `dev@taskinfa.local` / `DevPass123!`
Skip orchestrator (UI-only work): `./dev.sh --no-orchestrator`

Settings in `dev-sh-config.json` (committed). Auto-generated files are gitignored — never commit `.dev.vars`, `.env.local`, `.env`, or log files.

---

## Architecture

```
packages/dashboard      Next.js app → Cloudflare Workers (@opennextjs/cloudflare)
packages/telegram       Cloudflare Worker, Telegram bot, shares D1 database
scripts/orchestrator.ts Node.js daemon — polls /api/tasks, spawns Claude sessions
.claude/settings.json   Claude hooks — POSTs events to /api/events
```

### Task status flow
```
backlog → todo → in_progress → ai_review → review → done
                             ↘ review_rejected (fix loop)
         ↗ refinement (optional)
```

### Key API routes
- `GET/POST /api/tasks` — task CRUD; orchestrator polls this
- `GET/POST /api/task-lists` — project CRUD
- `GET/POST /api/sessions` — Claude session tracking
- `POST /api/events` — Claude hook events → Telegram notifications
- `GET /overview` — global project status

---

## For Claude Sessions Spawned by the Orchestrator

Sessions run inside a **project repo**, NOT this dashboard repo.

**DO:** work on assigned task → feature branch → commit → push → PR → update `.memory/context.md`
**DON'T:** push to main, modify dashboard codebase, commit secrets, mark task `done` (orchestrator handles transitions)

Use `KANBAN_API_URL` + `KANBAN_API_KEY` env vars for API calls back to the board.
