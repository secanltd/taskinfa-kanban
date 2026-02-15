# Project Context

## Last Updated: 2026-02-15

## Recent Changes

### AI Review Feature in Orchestrator (feat: ai-review)
- **Updated** `scripts/orchestrator.ts`:
  - Added `FeatureToggle` interface, `getFeatureToggles()`, `isAiReviewEnabled()`, `getAiReviewConfig()` helpers
  - Added `getTasksByStatus()` generic task fetcher, `parseRepoSlug()`, `parsePrNumber()` utilities
  - Added `review_rounds` and `completion_notes` fields to `Task` interface, `labels` field
  - Modified `startClaudeSession()` success handler: moves task to `ai_review` instead of `review` when toggle is ON
  - Added `buildAiReviewPrompt()`, `buildFixReviewPrompt()`, `startAiReviewSession()`, `startFixReviewSession()`
  - Updated `pollCycle()` with priority order: review_rejected > ai_review > todo
  - Added `sortByPriority()` helper to deduplicate priority sorting logic
  - AI review config: `max_review_rounds` (default 3), `auto_advance_on_approve` (default true)

### Dynamic Kanban Board Columns (feat: dynamic-kanban-columns)
- **Updated** `packages/shared/src/types/index.ts`:
  - Expanded `TaskStatus` type with new values: `refinement`, `ai_review`, `review_rejected`
  - Added `StatusColumn` interface and `getStatusColumns()` utility
  - Added `getValidStatuses()` utility
  - Full order: Backlog -> Refinement -> To Do -> Review Rejected -> In Progress -> AI Review -> Review -> Done
- **Created** `packages/dashboard/migrations/011_dynamic_task_statuses.sql`
- **Updated** KanbanBoard, TaskModal, and tasks API routes for dynamic statuses

### Feature Toggle System (feat: feature-toggles)
- **Created** `packages/dashboard/migrations/010_feature_toggles.sql` — New `feature_toggles` table
- **Created** `GET /api/feature-toggles` and `PATCH /api/feature-toggles/:feature_key` routes
- **Updated** `packages/shared/src/types/index.ts` — Added feature toggle types:
  - `FeatureKey`, `FeatureToggle`, `RefinementConfig`, `AiReviewConfig`, `FeatureConfigMap`
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
