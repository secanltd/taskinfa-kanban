# Migration Tracking - Action Plan

**Created:** 2026-02-17
**Status:** ⚠️ **ACTION REQUIRED** before pushing to test/prod

---

## Summary

All changes have been committed to align with SECAN dev workflow standards. However, **test and production databases need a one-time transition** before the new tracked migration workflow will work.

## The Problem (You Correctly Identified!)

All existing migrations (002-014) were applied using:
```bash
wrangler d1 execute <db> --remote --file=migrations/XXX.sql  # ❌ No tracking
```

The `d1_migrations` table doesn't know about these migrations. If we run:
```bash
wrangler d1 migrations apply <db> --remote  # ✅ Tracked, but...
```

It will try to re-run ALL migrations → **Errors** (tables already exist).

---

## The Solution

### 1. Transition Migration (Manual, One-Time)

We created a **transition migration** that:
- Creates `d1_migrations` table
- Marks all already-applied migrations (001-014) as complete
- Future migrations are tracked automatically

**Location:** `packages/dashboard/migrations/manual/transition_for_test_prod.sql`

**This file is NOT in the main migrations directory**, so it won't run automatically. You must apply it manually to test/prod databases.

### 2. Action Steps

#### ✅ Step 1: Push Code (Safe)

```bash
# These commits are already done and safe to push:
git push origin main
```

This pushes:
- ✅ `dev.sh` and documentation
- ✅ Updated migration workflow
- ✅ `001_initial_schema.sql` (for fresh local databases)
- ✅ Transition migration (in manual/ subdirectory, won't auto-run)

**Safe because:** The transition migration is in `migrations/manual/` and won't be picked up by the automated workflow yet.

#### ⚠️ Step 2: Apply Transition to Test Database (BEFORE using new workflow)

**Option A: Manual application (Recommended for first time)**

```bash
cd packages/dashboard

# Apply the transition migration manually
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --file=migrations/manual/transition_for_test_prod.sql

# Verify it worked
npx wrangler d1 migrations list taskinfa-kanban-test-db --remote

# Should output:
# 001_initial_schema.sql (applied)
# 002_add_comments.sql (applied)
# ... (all existing migrations marked as applied)
```

**Option B: Via temporary CI/CD tag**

1. Temporarily move transition migration to main directory:
   ```bash
   cp migrations/manual/transition_for_test_prod.sql migrations/000_transition.sql
   git add migrations/000_transition.sql
   git commit -m "temp: add transition migration for test"
   git push origin main
   ```

2. Apply via tag:
   ```bash
   git tag migratedb/test/v2.2.1-transition
   git push origin migratedb/test/v2.2.1-transition
   ```

3. After CI completes, remove temporary migration:
   ```bash
   git rm migrations/000_transition.sql
   git commit -m "chore: remove temporary transition migration"
   git push origin main
   ```

#### ✅ Step 3: Verify Test Database

```bash
cd packages/dashboard

# Check d1_migrations table contents
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --command "SELECT name FROM d1_migrations ORDER BY name;"

# Should list:
# 001_initial_schema.sql
# 002_add_comments.sql
# 003_add_users.sql
# ... (all through 014)
```

#### ✅ Step 4: Test New Workflow

Create a test migration to verify tracking works:

```bash
cd packages/dashboard

# Create test migration
npm run db:migrations:create -- test_tracking

# Edit migrations/YYYYMMDDHHMMSS_test_tracking.sql:
# -- Test migration
# SELECT 1 as test;

# Commit and tag
git add migrations/
git commit -m "test: verify migration tracking"
git push origin main

git tag migratedb/test/v2.2.2
git push origin migratedb/test/v2.2.2

# Watch GitHub Actions - should succeed ✅
# Verify it was tracked:
npx wrangler d1 migrations list taskinfa-kanban-test-db --remote
```

#### ✅ Step 5: Apply to Production (After test verification)

**Only after confirming test works!**

```bash
cd packages/dashboard

# Apply transition migration to prod
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --file=migrations/manual/transition_for_test_prod.sql

# Verify
npx wrangler d1 migrations list taskinfa-kanban-prod-db --remote

# Should list all 001-014 as applied
```

---

## Timeline

### Today (Before using new workflow):
- [x] Push code to main ✅ (safe, transition is in manual/)
- [ ] Apply transition migration to test DB
- [ ] Verify d1_migrations table populated
- [ ] Test new workflow with a test migration

### This Week:
- [ ] Apply transition migration to prod DB
- [ ] Verify prod database tracking
- [ ] Document in team wiki

### Going Forward:
- [ ] Use tag-based workflow for all migrations
- [ ] Never use `wrangler d1 execute --file` again

---

## Quick Reference

### For Fresh Local Development

```bash
cd packages/dashboard

# Just run migrations normally - 001 creates initial schema
npm run db:migrate

# Or with wrangler directly:
npx wrangler d1 migrations apply taskinfa-kanban-db --local
```

Migrations will apply in order: 001, 002, 003, ...

### For Test/Production (One-Time Transition)

```bash
cd packages/dashboard

# Apply transition migration manually
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --file=migrations/manual/transition_for_test_prod.sql

# Verify
npx wrangler d1 migrations list taskinfa-kanban-test-db --remote
```

### After Transition Complete (Future Migrations)

```bash
# 1. Create migration
cd packages/dashboard
npm run db:migrations:create -- add_feature

# 2. Edit migration file
# migrations/YYYYMMDDHHMMSS_add_feature.sql

# 3. Test locally
npm run db:migrate

# 4. Commit and tag
git add migrations/
git commit -m "feat: add feature migration"
git push origin main

git tag migratedb/test/v2.3.0
git push origin migratedb/test/v2.3.0

# GitHub Actions applies migration ✅
# After testing, deploy to prod:
git tag migratedb/prod/v2.3.0
git push origin migratedb/prod/v2.3.0
```

---

## Verification Commands

### Check which migrations D1 thinks are applied:
```bash
npx wrangler d1 migrations list taskinfa-kanban-test-db --remote
```

### Check d1_migrations table directly:
```bash
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --command "SELECT * FROM d1_migrations ORDER BY name;"
```

### List all migration files:
```bash
ls -1 packages/dashboard/migrations/*.sql
```

---

## What Changed

### Files Added:
- ✅ `migrations/001_initial_schema.sql` - Base schema for fresh DBs
- ✅ `migrations/manual/transition_for_test_prod.sql` - One-time transition
- ✅ `MIGRATION_TRANSITION_GUIDE.md` - Detailed guide
- ✅ `MIGRATION_ACTION_PLAN.md` - This file

### Files Modified:
- ✅ `package.json` - Updated to use `migrations apply`
- ✅ `wrangler.toml` - Added `migrations_dir` config
- ✅ `.github/workflows/migrate-db.yml` - Uses `migrations apply`
- ✅ `CLAUDE.md` - Updated migration best practices

### Files Removed:
- None (transition migration is in manual/ subdirectory)

---

## Safety Notes

✅ **Safe to push now:** Code is committed but transition migration won't run automatically

⚠️ **Before first migratedb/ tag:** Apply transition migration to test DB manually

✅ **Fresh local DBs:** Work fine with new setup (001 creates schema)

❌ **Don't run transition twice:** Uses `INSERT OR IGNORE`, safe if run multiple times

✅ **Rollback plan:** If something breaks, you can still use old method:
```bash
npx wrangler d1 execute <db> --remote --file=migrations/XXX.sql
```

---

## Questions?

1. **Can I push this code now?** → **YES**, transition migration is in manual/ directory
2. **Will it break test/prod?** → **NO**, workflow won't run until you tag migratedb/*
3. **What if I tag migratedb/test/* before transition?** → It will fail (tables already exist)
4. **Can I test locally first?** → **YES**, fresh local DB works fine with new setup

---

## Next Step

**Choose one:**

### Option A: Manual Transition (Recommended)
```bash
cd packages/dashboard
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --file=migrations/manual/transition_for_test_prod.sql
```

### Option B: Push and document
```bash
# Push code (safe)
git push origin main

# Add note to team: "Apply transition migration manually before using new workflow"
# Share this file: MIGRATION_ACTION_PLAN.md
```

---

**Status:** ⚠️ **Ready to push, but apply transition migration to test/prod before using tag-based workflow**

**Priority:** Medium (can push code now, transition can be done this week)
