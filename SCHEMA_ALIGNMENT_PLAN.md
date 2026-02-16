# Schema Alignment Plan - Production to Match Test

**Date:** 2026-02-17
**Purpose:** Make production database schema exactly identical to test/local

---

## Current Differences

### 1. Tasks Table Status Constraint

**Production (current):**
```sql
status CHECK(status IN ('backlog', 'todo', 'in_progress', 'review', 'done'))
-- 5 values
```

**Test/Local (target):**
```sql
status CHECK(status IN ('backlog', 'refinement', 'todo', 'review_rejected',
                        'in_progress', 'ai_review', 'review', 'done'))
-- 8 values - adds: refinement, review_rejected, ai_review
```

### 2. Tasks Table Field Order

**Production:** Fields added via ALTER TABLE are at the end (cosmetic)
**Test:** All fields in logical order

### 3. Indexes

**Production has:**
- `idx_tasks_assigned_to` (extra)
- `idx_tasks_status_order` (different name)

**Test has:**
- `idx_tasks_status_list_order` (correct name)

---

## Migration Strategy

### Migration 015: `015_align_prod_schema_with_test.sql`

**What it does:**
1. Creates new `tasks_new` table with correct schema
2. Copies ALL data from old `tasks` table
3. Drops old indexes
4. Replaces old table with new table
5. Recreates indexes to match test exactly

**Safety measures:**
- ✅ All data preserved via INSERT...SELECT
- ✅ Uses transactions (implicit in D1)
- ✅ Idempotent (safe to run multiple times)
- ✅ No data loss (copies all rows)

**Risks:**
- ⚠️ Recreates table (brief downtime during migration)
- ⚠️ Foreign keys temporarily broken during swap
- ⚠️ Must run on production only (test already correct)

---

## Execution Plan

### Phase 1: Test Locally (Required)

```bash
cd packages/dashboard

# Apply to fresh local database
rm -rf .wrangler/state/v3/d1/
npx wrangler d1 migrations apply taskinfa-kanban-db --local

# Verify schema
npx wrangler d1 execute taskinfa-kanban-db --local \
  --command "SELECT sql FROM sqlite_master WHERE name='tasks';"

# Should match test schema exactly
```

### Phase 2: Apply to Test Database (Verification)

```bash
# Tag for test deployment
git tag migratedb/test/v2.3.0-schema-align
git push origin migratedb/test/v2.3.0-schema-align

# Wait for GitHub Actions to complete
# Verify schema matches
npx wrangler d1 execute taskinfa-kanban-test-db --remote \
  --command "SELECT sql FROM sqlite_master WHERE name='tasks';"
```

### Phase 3: Apply to Production (After Verification)

**⚠️ CRITICAL: Only after confirming test works!**

```bash
# Tag for production deployment
git tag migratedb/prod/v2.3.0-schema-align
git push origin migratedb/prod/v2.3.0-schema-align

# Monitor GitHub Actions
# Verify production schema
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --command "SELECT sql FROM sqlite_master WHERE name='tasks';"
```

---

## Pre-Migration Checklist

Before applying to production:

### ✅ Verification Steps

- [ ] Migration tested locally with fresh database
- [ ] Migration tested on test database successfully
- [ ] Test database schema verified to match local
- [ ] No data lost in test migration
- [ ] All indexes present in test database
- [ ] GitHub Actions workflow completed successfully
- [ ] Test environment functional after migration

### ✅ Backup Steps (Optional but Recommended)

```bash
# Export production tasks before migration
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --command "SELECT * FROM tasks;" --json > tasks_backup_$(date +%Y%m%d).json

# Count rows before migration
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --command "SELECT COUNT(*) as count FROM tasks;"
```

### ✅ Post-Migration Verification

```bash
# 1. Verify row count matches
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --command "SELECT COUNT(*) as count FROM tasks;"

# 2. Verify schema is correct
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --command "SELECT sql FROM sqlite_master WHERE name='tasks';"

# 3. Verify indexes exist
npx wrangler d1 execute taskinfa-kanban-prod-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks' ORDER BY name;"

# Should show:
# - idx_tasks_parent_task
# - idx_tasks_priority
# - idx_tasks_status
# - idx_tasks_status_list_order
# - idx_tasks_task_list
# - idx_tasks_workspace_created
# - idx_tasks_workspace_status

# 4. Test application functionality
# - Create new task with status 'refinement' (new status)
# - Verify existing tasks still load
# - Verify kanban board works
```

---

## Rollback Plan

If migration fails on production:

### Option 1: Restore from Backup (if created)

```bash
# This would require manual SQL to restore
# Better to prevent than to rollback
```

### Option 2: Revert Migration

Since we're using tracked migrations, you can't easily "undo" a migration in D1. Prevention is key:

- ✅ Test thoroughly on local
- ✅ Test thoroughly on test database
- ✅ Verify before applying to production

---

## Timeline

### Today:
1. [x] Create migration 015
2. [x] Test locally (fresh database)
3. [ ] Push to feature branch
4. [ ] Create PR
5. [ ] Run CI checks

### After PR Approval:
6. [ ] Merge to main
7. [ ] Apply transition migration to test/prod (migrations/manual/)
8. [ ] Apply migration 015 to test database
9. [ ] Verify test database schema

### After Test Verification (Next Day):
10. [ ] Apply migration 015 to production
11. [ ] Verify production schema
12. [ ] Test production functionality

---

## Commands Reference

### Local Testing
```bash
cd packages/dashboard

# Fresh database
rm -rf .wrangler/state/v3/d1/

# Apply all migrations
npx wrangler d1 migrations apply taskinfa-kanban-db --local

# Check schema
npx wrangler d1 execute taskinfa-kanban-db --local \
  --command "SELECT sql FROM sqlite_master WHERE name='tasks' LIMIT 1;" \
  | grep -A 50 "results"
```

### Test Database
```bash
# Tag deployment
git tag migratedb/test/v2.3.0-align
git push origin migratedb/test/v2.3.0-align

# Verify
npx wrangler d1 migrations list taskinfa-kanban-test-db --remote
```

### Production Database
```bash
# Tag deployment (ONLY after test verification)
git tag migratedb/prod/v2.3.0-align
git push origin migratedb/prod/v2.3.0-align

# Verify
npx wrangler d1 migrations list taskinfa-kanban-prod-db --remote
```

---

## Expected Results

After migration 015 completes:

### Tasks Table Schema (All Environments)
```sql
CREATE TABLE "tasks" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK(status IN ('backlog', 'refinement', 'todo', 'review_rejected',
                      'in_progress', 'ai_review', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  labels TEXT NOT NULL DEFAULT '[]',
  assignee TEXT,
  assigned_to TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,

  loop_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  files_changed TEXT NOT NULL DEFAULT '[]',
  completion_notes TEXT,

  pr_url TEXT,
  branch_name TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)
```

### Indexes (All Environments)
```
idx_tasks_parent_task
idx_tasks_priority
idx_tasks_status
idx_tasks_status_list_order        ← Aligned
idx_tasks_task_list
idx_tasks_workspace_created
idx_tasks_workspace_status
```

**No more:**
- ❌ `idx_tasks_assigned_to` (removed from prod)
- ❌ `idx_tasks_status_order` (replaced with idx_tasks_status_list_order)

---

## Success Criteria

Migration is successful when:

✅ Production schema matches test schema byte-for-byte
✅ All tasks data preserved (same row count)
✅ All indexes created correctly
✅ Application functions normally
✅ New status values ('refinement', 'review_rejected', 'ai_review') can be used
✅ No errors in production logs

---

**Status:** ⚠️ **Ready for testing - DO NOT apply to production yet**

**Next Step:** Test migration 015 locally, then on test database
