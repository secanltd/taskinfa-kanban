# Deployment

We use `@opennextjs/cloudflare` — **not** the deprecated `@cloudflare/next-on-pages`.

## Deploy via CI tags only (never manually unless emergency)

```bash
git tag deploy/test/X.Y.Z && git push origin deploy/test/X.Y.Z
git tag deploy/prod/X.Y.Z && git push origin deploy/prod/X.Y.Z
```

## URLs

- Test: https://taskinfa-kanban-test.secan-ltd.workers.dev
- Prod: https://taskinfa-kanban-prod.secan-ltd.workers.dev

## Critical Route File Rules

- **Do NOT add** `export const runtime = 'edge'` to any route file
- The Workers adapter uses Node.js runtime automatically
- Build output goes to `.open-next/`, not `.vercel/`

## Required Worker Secrets

Set via `wrangler secret put <KEY> --env <test|production>`:
- `JWT_SECRET`

## Orchestrator Release

```bash
./scripts/release-orchestrator.sh
```
