# Migration Tracking Transition Guide

**Date:** 2026-02-17
**Critical:** Read this before running migrations on test/production

---

## The Problem

All existing migrations (002-014) were applied using:

```bash
wrangler d1 execute <db-name> --remote --file=migrations/XXX.sql
```

**This method does NOT track migrations.** The `d1_migrations` table is either empty or doesn't exist.

If we run the new workflow now:
```bash
wrangler d1 migrations apply taskinfa-kanban-test-db --remote
```

It will try to re-apply ALL migrations → **Errors** (tables already exist)

---

## The Solution

We created a **one-time transition migration** that:
1. Creates `d1_migrations` table
2. Marks all already-applied migrations (002-014) as complete
3. Future migrations will be tracked automatically

**File:** `packages/dashboard/migrations/000_initialize_migration_tracking.sql`

---

## Transition Steps

### Step 1: Apply Locally (Test First)

```bash
cd packages/dashboard

# Apply the transition migration locally
npm run db:migrate

# Verify it worked
npm run db:migrations:list
# Should show:
# - 000_initialize_migration_tracking.sql
# - 002_add_comments.sql
# - 003_add_users.sql
# - ... (all existing migrations)
```

### Step 2: Apply to Test Environment

**Option A: Using the CI/CD workflow (Recommended)**

```bash
# 1. Commit the transition migration
git add packages/dashboard/migrations/000_initialize_migration_tracking.sql
git commit -m "feat: add migration tracking transition for test/prod"
git push origin main

# 2. Tag for test migration
git tag migratedb/test/v2.2.1
git push origin migratedb/test/v2.2.1

# 3. Watch GitHub Actions
# https://github.com/secanltd/taskinfa-kanban/actions

# 4. Verify in test database
cd packages/dashboard
npm run db:migrations:list:test
# Should show all migrations marked as applied
```

**Option B: Manual (if CI/CD fails)**

```bash
cd packages/dashboard

# Apply transition migration manually
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --file=migrations/000_initialize_migration_tracking.sql

# Verify
npx wrangler d1 migrations list taskinfa-kanban-test-db --remote
```

### Step 3: Verify Test Environment

```bash
# Check that d1_migrations table exists and has all migrations
cd packages/dashboard

npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --command "SELECT name FROM d1_migrations ORDER BY name;"

# Should output:
# 000_initialize_migration_tracking.sql
# 002_add_comments.sql
# 003_add_users.sql
# ...
# 014_fix_comment_type_constraint.sql
```

### Step 4: Test New Migration Workflow

Create a test migration to verify tracking works:

```bash
cd packages/dashboard

# Create test migration
npm run db:migrations:create -- test_tracking_verification

# Edit the file (add a simple comment)
# migrations/YYYYMMDDHHMMSS_test_tracking_verification.sql:
# -- Test migration to verify tracking works
# SELECT 1;

# Commit and tag for test
git add migrations/
git commit -m "test: verify migration tracking"
git push origin main

git tag migratedb/test/v2.2.2
git push origin migratedb/test/v2.2.2

# Watch GitHub Actions - should succeed
# Check that new migration is tracked
npm run db:migrations:list:test
```

### Step 5: Apply to Production

**Only after verifying test works!**

```bash
# Tag for production migration
git tag migratedb/prod/v2.2.1
git push origin migratedb/prod/v2.2.1

# Watch GitHub Actions
# https://github.com/secanltd/taskinfa-kanban/actions

# Verify
cd packages/dashboard
npm run db:migrations:list:prod
```

---

## Verification Checklist

### ✅ Local Database
- [ ] Run `npm run db:migrate`
- [ ] Run `npm run db:migrations:list` - shows 000 and 002-014
- [ ] No errors

### ✅ Test Database
- [ ] Tag `migratedb/test/v2.2.1` pushed
- [ ] GitHub Actions succeeded
- [ ] `npm run db:migrations:list:test` shows all migrations
- [ ] Test migration created and tracked successfully

### ✅ Production Database
- [ ] Tag `migratedb/prod/v2.2.1` pushed
- [ ] GitHub Actions succeeded
- [ ] `npm run db:migrations:list:prod` shows all migrations
- [ ] No errors in production logs

---

## Troubleshooting

### Issue: "table d1_migrations already exists"

**Cause:** D1 already created the table

**Solution:** This is fine! The migration uses `CREATE TABLE IF NOT EXISTS`, so it will skip table creation and just insert records.

### Issue: Duplicate migration entries

**Cause:** Ran the transition migration multiple times

**Solution:** The migration uses `INSERT OR IGNORE`, so duplicates are automatically skipped. Verify:

```bash
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --command "SELECT name, COUNT(*) as count FROM d1_migrations GROUP BY name HAVING count > 1;"
# Should return no rows (no duplicates)
```

### Issue: Migration XXX not in d1_migrations table

**Cause:** Missing from the 000 transition migration

**Solution:** Add it manually:

```bash
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --command "INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('XXX.sql', '2026-01-01 00:00:00');"
```

### Issue: GitHub Actions fails with "migration already applied"

**Cause:** Transition migration was applied manually before CI/CD

**Solution:** This is expected. D1 will skip already-applied migrations. Check the logs - it should say "already applied" and continue.

---

## Future Migrations (After Transition)

Once the transition is complete, all future migrations are simple:

```bash
# 1. Create migration
cd packages/dashboard
npm run db:migrations:create -- add_new_feature

# 2. Edit migration file
# migrations/YYYYMMDDHHMMSS_add_new_feature.sql

# 3. Test locally
npm run db:migrate

# 4. Commit and tag
git add migrations/
git commit -m "feat: add new feature migration"
git push origin main

git tag migratedb/test/v2.3.0
git push origin migratedb/test/v2.3.0

# 5. After testing, deploy to prod
git tag migratedb/prod/v2.3.0
git push origin migratedb/prod/v2.3.0
```

**No manual steps required!** ✅

---

## Why This Works

### Before (Untracked)
```
┌─────────────────────────┐
│  Test/Prod Database     │
├─────────────────────────┤
│ ✓ tables exist          │
│ ✓ data exists           │
│ ❌ d1_migrations empty   │  ← Problem!
└─────────────────────────┘

wrangler d1 migrations apply
→ Tries to run all migrations
→ Tables already exist
→ ❌ FAIL
```

### After (Tracked)
```
┌─────────────────────────┐
│  Test/Prod Database     │
├─────────────────────────┤
│ ✓ tables exist          │
│ ✓ data exists           │
│ ✓ d1_migrations         │  ← Fixed!
│   - 000_initialize...   │
│   - 002_add_comments    │
│   - ...014_fix...       │
└─────────────────────────┘

wrangler d1 migrations apply
→ Checks d1_migrations table
→ Skips already-applied migrations
→ ✓ SUCCESS
```

---

## Timeline

**Immediate (Now):**
1. Review `000_initialize_migration_tracking.sql`
2. Test locally: `npm run db:migrate`
3. Verify locally: `npm run db:migrations:list`

**Today:**
4. Commit transition migration
5. Apply to test: `git tag migratedb/test/v2.2.1`
6. Verify test database

**This Week:**
7. Test new migration workflow in test env
8. Apply to production: `git tag migratedb/prod/v2.2.1`
9. Document in team wiki

**Going Forward:**
10. Use tag-based workflow for all migrations
11. Never use `wrangler d1 execute --file` again

---

## Questions?

- Check logs: `npm run db:migrations:list:test`
- Verify table: `wrangler d1 execute <db> --remote --command "SELECT * FROM d1_migrations;"`
- GitHub Actions: https://github.com/secanltd/taskinfa-kanban/actions

---

**Status:** ⚠️ **Transition Required Before Using New Workflow**

**Next Step:** Apply `000_initialize_migration_tracking.sql` to test database
