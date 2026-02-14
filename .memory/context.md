# Project Context

## Last Updated: 2026-02-14

## Recent Changes

### Task Search, Filtering, and Sorting (feat: task-search-filtering)
- **Created** `packages/dashboard/migrations/011_task_search_and_saved_filters.sql` — FTS5 virtual table `tasks_fts` for full-text search across title/description/labels, with insert/update/delete triggers to keep index in sync; `saved_filters` table for persisting user filter presets
- **Updated** `packages/dashboard/src/app/api/tasks/route.ts` — Extended GET endpoint with `q` (FTS5 search), `label`, `assignee`, `created_after`, `created_before`, `sort` (created_at/updated_at/priority/title/order), `order` (asc/desc) query parameters
- **Created** `packages/dashboard/src/app/api/saved-filters/route.ts` — GET (list) and POST (create) endpoints for saved filters
- **Created** `packages/dashboard/src/app/api/saved-filters/[id]/route.ts` — DELETE endpoint for saved filters
- **Created** `packages/dashboard/src/components/TaskFilterToolbar.tsx` — Search bar with debounced input, filter panel dropdown (status, priority, project, label, date range), sort controls, active filter badges, saved filter management
- **Updated** `packages/dashboard/src/components/KanbanBoard.tsx` — Integrated TaskFilterToolbar, added client-side filtered task fetching via API, URL-based filter persistence via `useSearchParams`/`useRouter`, saved filters CRUD
- **Updated** `packages/dashboard/src/app/dashboard/page.tsx` — Added Suspense wrapper for KanbanBoard (required by useSearchParams)
- **Updated** `packages/shared/src/types/index.ts` — Added `TaskFilters`, `TaskSortField`, `SortOrder`, `SavedFilter` types; extended `ListTasksRequest` with new filter/sort fields
- **Migration required**: `npm run db:migrate:test -- --file=./migrations/011_task_search_and_saved_filters.sql`

### API Rate Limiting and Abuse Protection (feat: rate-limiting) — PR #44
- **Created** `packages/dashboard/migrations/010_rate_limit.sql` — D1 table `rate_limit_entries` for sliding window tracking
- **Rewritten** `packages/dashboard/src/lib/middleware/rateLimit.ts` — D1-based sliding window rate limiter (replaces non-functional in-memory version)
- **Created** `packages/dashboard/src/lib/middleware/apiRateLimit.ts` — Higher-level helpers: `rateLimitApi()`, `rateLimitAuth()`, `applyRateLimitHeaders()`
- **Updated** `packages/dashboard/src/lib/auth/jwt.ts` — `authenticateRequestUnified` now returns `keyId`, `authType` in `UnifiedAuthResult` interface
- **Updated** all API route handlers — Integrated D1-based rate limiting after authentication
- **Rate limit tiers**: Login 10/min (IP), Signup 5/min (IP), API key creation 10/hr (session), Standard API 100/min (per-key), Orchestrator 1000/min (config ready)
- **Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on all responses; Retry-After on 429
- **Design**: Fail-open (if rate limit check fails, request proceeds), opportunistic cleanup (~5% of requests)
- **Migration required**: `npm run db:migrate:test -- --file=./migrations/010_rate_limit.sql`

### Responsive Design Improvement (feat: responsive-design)
- **Created** `packages/dashboard/src/components/MobileNav.tsx` - Hamburger menu component for mobile navigation
- **Updated** `packages/dashboard/src/app/layout.tsx` - Added separate viewport export for mobile viewport settings
- **Updated** `packages/dashboard/src/app/globals.css` - Touch-friendly button/input classes (min-h-[44px], touch-manipulation, text-base on mobile inputs to prevent iOS zoom)
- **Updated** `packages/dashboard/src/app/dashboard/page.tsx` - Added MobileNav, responsive padding/font sizes, hidden desktop nav on mobile
- **Updated** `packages/dashboard/src/app/overview/page.tsx` - Added MobileNav, responsive stats cards
- **Updated** `packages/dashboard/src/app/settings/page.tsx` - Responsive header, padding, break-all for long workspace IDs
- **Updated** `packages/dashboard/src/app/projects/page.tsx` - Responsive header with compact back button
- **Updated** `packages/dashboard/src/app/auth/login/page.tsx` and `signup/page.tsx` - Responsive header/footer padding
- **Updated** `packages/dashboard/src/components/KanbanBoard.tsx` - Responsive columns (260px mobile, 288px desktop), flex-wrap header, touch-friendly session button
- **Updated** `packages/dashboard/src/components/Modal.tsx` - Bottom sheet pattern on mobile (slides up from bottom), responsive padding
- **Updated** `packages/dashboard/src/components/CreateTaskModal.tsx` - Single-column grid on mobile, responsive priority buttons
- **Updated** `packages/dashboard/src/components/TaskModal.tsx` - Responsive grids, touch-friendly edit/delete buttons
- **Updated** `packages/dashboard/src/components/SessionsPanel.tsx` - Responsive max-height
- **Updated** `packages/dashboard/src/components/projects/ProjectsTable.tsx` - Dual layout: card view on mobile, table on desktop
- **Updated** `packages/dashboard/src/components/settings/ApiKeyList.tsx` - Dual layout: card view on mobile, table on desktop
- **Updated** `packages/dashboard/src/components/settings/ApiKeyItem.tsx` - Added card/row variant prop for mobile/desktop
- **Updated** `packages/dashboard/src/components/auth/LoginForm.tsx` and `SignupForm.tsx` - Responsive card padding and heading sizes

### Merge and Deploy (2026-02-13)
- **Merged** PR #32 (Fix taskinfa update CLI self-update) into main
- **Tagged** `orchestrator/v1.0.5` — triggers release workflow (orchestrator.js + taskinfa-cli.sh)
- **Tagged** `deploy/test/2.0.14` — deploys dashboard to test environment
- **Tagged** `deploy/prod/2.0.14` — deploys dashboard to production environment

### Fix version parsing in taskinfa doctor and update (fix: version-parsing)
- **Fixed** `get_installed_version()` in `scripts/install.sh`:
  - Old regex `="(\d+\.\d+\.\d+)"` was too generic, matched first semver string in bundled file
  - New regex `Orchestrator v(\d+\.\d+\.\d+)` matches the specific log string in orchestrator.js
- **Fixed** `get_latest_version()` in `scripts/install.sh`:
  - Old code `tag.replace(/^v/, '')` didn't handle `orchestrator/v1.0.5` tag format
  - New code `tag.replace(/^.*\/v?/, '')` strips everything up to and including the slash + optional v

### Fix taskinfa update CLI self-update (fix: taskinfa-update-cli)
- **Modified** `scripts/install.sh` `cmd_update()`:
  - Now downloads and replaces the CLI script itself (`$TASKINFA_HOME/bin/taskinfa`) from `taskinfa-cli.sh` release asset
  - CLI update happens before orchestrator update so new features take effect on next run
  - Safe update pattern: downloads to `.tmp`, validates non-empty, then moves into place
  - CLI download failure is non-fatal (warning only), orchestrator download failure is fatal
- **Created** `scripts/extract-cli.sh`:
  - Extracts the CLI heredoc from `install.sh` into a standalone file for release packaging
  - Validates output is non-empty and starts with shebang
- **Updated** `.github/workflows/release-orchestrator.yml`:
  - Added "Extract CLI script" step that runs `scripts/extract-cli.sh`
  - Added `dist/taskinfa-cli.sh` as a GitHub Release asset alongside `orchestrator.js`

### Global Modal Component (feat: global-modal-component)
- **Created** `packages/dashboard/src/components/Modal.tsx` - A reusable global Modal component with:
  - `Modal` (default export): Handles backdrop, click-outside-to-close, ESC key, body scroll lock, size variants (sm/md/lg/xl)
  - `ModalHeader`: Consistent header with title, optional action buttons, and close button
  - `ModalFooter`: Consistent footer with right-aligned content and border styling
  - `onEscapeKey` prop for custom ESC behavior (e.g., TaskModal's context-aware ESC handling)
- **Refactored** `CreateTaskModal.tsx` to use `Modal`, `ModalHeader`, `ModalFooter` (removed ~20 lines of duplicated boilerplate)
- **Refactored** `TaskModal.tsx` to use `Modal`, `ModalHeader`, `ModalFooter` with custom `onEscapeKey` handler
- **Refactored** `ApiKeyCreateDialog.tsx` to use `Modal`, `ModalHeader`, `ModalFooter`
- All modals now share consistent backdrop, keyboard handling, scroll lock, and styling

## Architecture Notes
- Rate limiting uses D1 sliding window (not in-memory, which doesn't work in stateless Workers)
- Rate limit keys: `ip:<ip>:<endpoint>` for auth, `apikey:<keyId>` for API, `session:<userId>:<endpoint>` for session-based
- No external modal library used - pure React + Tailwind CSS
- Terminal dark theme with CSS custom properties (--terminal-*)
- Custom CSS utility classes: btn-primary, btn-secondary, btn-danger, input-field, card
- Mobile-first responsive design with Tailwind breakpoints (sm: 640px, md: 768px)
- Bottom sheet modal pattern on mobile devices
- Dual card/table layouts for data-heavy views on mobile vs desktop
