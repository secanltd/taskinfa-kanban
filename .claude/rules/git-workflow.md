# Git Workflow

## This Repo (taskinfa-kanban)

**NEVER push directly to `main` — it is protected.**

When asked to commit:
1. Create a branch: `feat/short-name` or `fix/short-name`
2. Commit on that branch
3. Push with `-u`
4. Output the PR URL: `https://github.com/secanltd/taskinfa-kanban/compare/<branch>?expand=1`

**NEVER add Co-Authored-By lines to commits.**

### Conventional Commits format
```
feat: add priority filter to task list

- filter applied in GET /api/tasks
- UI dropdown in kanban header
```
Prefixes: `feat` `fix` `docs` `refactor` `test` `chore`

Branch naming: `feat/` `fix/` `docs/` `refactor/`

## Deploy via CI tags (never manually unless emergency)

```bash
git tag deploy/test/X.Y.Z && git push origin deploy/test/X.Y.Z
git tag deploy/prod/X.Y.Z && git push origin deploy/prod/X.Y.Z
```

## Migrate via CI tags

```bash
git tag migratedb/test/vX.Y.Z && git push origin migratedb/test/vX.Y.Z
git tag migratedb/prod/vX.Y.Z && git push origin migratedb/prod/vX.Y.Z
```

## Orchestrator release

```bash
./scripts/release-orchestrator.sh
```
