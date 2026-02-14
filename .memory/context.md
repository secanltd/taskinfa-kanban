# Project Context

## Last Updated: 2026-02-14

## Recent Changes

### Refinement Feature in Orchestrator (feat: orchestrator-refinement)
- **Updated** `scripts/orchestrator.ts`:
  - Added `labels` field to `Task` interface and `FeatureToggle` interface
  - Added `getFeatureToggles()` to fetch workspace feature toggles from `/api/feature-toggles`
  - Added `isRefinementEnabled()` and `getRefinementConfig()` helpers
  - Added `getRefinementTasks()` to fetch tasks with `status=refinement`, skipping tasks with `refined` label
  - Added `buildRefinementPrompt()` — generates a restricted prompt that only allows API calls (no code changes, no git)
  - Added `startRefinementSession()` — spawns a Claude session for task refinement with session_type metadata
  - Updated `pollCycle()` to process refinement tasks after todo tasks (lower priority)
  - Refinement sessions: improve task title/description, add `refined` label, optionally auto-advance to `todo`
  - On refinement failure: increments error_count but leaves task in refinement status

### Dynamic Kanban Board Columns (feat: dynamic-kanban-columns)
- **Updated** `packages/shared/src/types/index.ts`:
  - Expanded `TaskStatus` type with new values: `refinement`, `ai_review`, `review_rejected`
  - Added `StatusColumn` interface and `getStatusColumns()` utility that builds dynamic columns based on enabled feature toggles
  - Added `getValidStatuses()` utility that returns valid statuses for a workspace
  - Column insertion rules: `refinement` between Backlog/To Do, `review_rejected` between To Do/In Progress, `ai_review` after In Progress
  - Full order: Backlog -> Refinement -> To Do -> Review Rejected -> In Progress -> AI Review -> Review -> Done
- **Created** `packages/dashboard/migrations/011_dynamic_task_statuses.sql`:
  - Recreates tasks table with expanded CHECK constraint for new status values
  - Preserves all existing data and indexes
- **Updated** `packages/dashboard/schema.sql` — Updated CHECK constraint for new statuses
- **Refactored** `packages/dashboard/src/components/KanbanBoard.tsx`:
  - Fetches feature toggles from `GET /api/feature-toggles` on mount
  - Dynamically builds `statusColumns` array using `getStatusColumns()` from shared package
  - Passes `statusColumns` to `TaskModal` for consistent status options
- **Updated** `packages/dashboard/src/components/TaskModal.tsx`:
  - Accepts optional `statusColumns` prop for dynamic status dropdown
  - Falls back to default columns when prop not provided
- **Updated** `packages/dashboard/src/app/api/tasks/[id]/route.ts`:
  - PATCH endpoint now dynamically validates status values based on workspace's enabled feature toggles
  - Queries `feature_toggles` table to determine valid statuses before validation

### Feature Toggle System (feat: feature-toggles)
- **Created** `packages/dashboard/migrations/010_feature_toggles.sql` — New `feature_toggles` table:
  - Fields: `id`, `workspace_id`, `feature_key`, `enabled`, `config` (JSON), `created_at`, `updated_at`
  - Unique constraint on `(workspace_id, feature_key)`
  - Indexes on `workspace_id` and `(workspace_id, feature_key)`
- **Created** `packages/dashboard/src/app/api/feature-toggles/route.ts` — `GET /api/feature-toggles`:
  - Lists all toggles for workspace, returns defaults for features not yet in DB
  - Supports both session cookie and API key auth
- **Created** `packages/dashboard/src/app/api/feature-toggles/[feature_key]/route.ts` — `PATCH /api/feature-toggles/:feature_key`:
  - Enable/disable a toggle and update config via upsert
  - Validates feature_key against known keys (refinement, ai_review)
- **Updated** `packages/shared/src/types/index.ts` — Added feature toggle types:
  - `FeatureKey`, `FeatureToggle`, `RefinementConfig`, `AiReviewConfig`, `FeatureConfigMap`
  - `ListFeatureTogglesResponse`, `UpdateFeatureToggleRequest`, `UpdateFeatureToggleResponse`
  - `DEFAULT_FEATURE_CONFIGS` constant with default configs for each feature
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
- No external modal library used - pure React + Tailwind CSS
- Terminal dark theme with CSS custom properties (--terminal-*)
- Custom CSS utility classes: btn-primary, btn-secondary, btn-danger, input-field, card
- Mobile-first responsive design with Tailwind breakpoints (sm: 640px, md: 768px)
- Bottom sheet modal pattern on mobile devices
- Dual card/table layouts for data-heavy views on mobile vs desktop
