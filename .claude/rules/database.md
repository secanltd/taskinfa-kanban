# Database Migrations

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

## D1 Production Gotchas

- **`ADD COLUMN IF NOT EXISTS` is not supported** — use `ADD COLUMN` without the guard, or recreate the table
- **`--env test/production` is required** for all remote wrangler commands (not `--env prod`)
- **Table recreation pattern**: use explicit column list in `INSERT INTO new_table SELECT col1, col2, ... FROM old_table` — never `SELECT *`
- **`DROP TABLE IF EXISTS`** is fine; it's DDL writes that have restrictions
- SQLite doesn't support `ALTER TABLE ... DROP COLUMN` on older D1 — always use the table-recreation pattern for column removal
