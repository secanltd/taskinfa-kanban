# Project Context

## Last Updated: 2026-02-15

## Recent Changes

### Feature Toggle Settings UI (feat: feature-toggle-settings-ui)
- **Created** `packages/dashboard/src/components/settings/FeatureToggleSettings.tsx`:
  - Client component with toggle switches for Refinement and AI Review features
  - Config options: `auto_advance` (checkbox) for Refinement; `auto_advance_on_approve` (checkbox) and `max_review_rounds` (number input) for AI Review
  - Calls `PATCH /api/feature-toggles/:feature_key` on toggle/config change
  - Board column preview showing which columns will appear based on enabled toggles
  - Feature-gated columns highlighted in green in the preview
  - Loading state, error handling, and optimistic UI updates
- **Updated** `packages/dashboard/src/app/settings/page.tsx`:
  - Added Feature Toggles section between Workspace and API Keys sections

### Task Dependencies and Subtask Support (feat: task-dependencies-subtasks)
- **Created** `packages/dashboard/migrations/012_subtasks_and_dependencies.sql`:
  - Added `parent_task_id` column to `tasks` table for subtask relationships
  - Created `task_dependencies` table (id, task_id, depends_on_task_id, workspace_id) with unique constraint
  - Added indexes for efficient queries on both tables
- **Updated** `packages/shared/src/types/index.ts`:
  - Added `parent_task_id` and optional `subtask_count`/`subtask_done_count` to `Task` interface
  - Added `TaskDependency`, `TaskWithRelations` interfaces
  - Added `AddDependencyRequest/Response`, `ListDependenciesResponse` types
  - Added `parent_task_id` to `CreateTaskRequest`
- **Created** `packages/dashboard/src/app/api/tasks/[id]/dependencies/route.ts`:
  - `GET` - List dependencies with blocked-by task details
  - `POST` - Add dependency with circular dependency detection
  - `DELETE` - Remove dependency by query param
- **Updated** `packages/dashboard/src/app/api/tasks/route.ts`:
  - GET: Added `parent_task_id` filter, subtask counts, and `is_blocked` status
  - POST: Support `parent_task_id` for creating subtasks
- **Updated** `packages/dashboard/src/app/api/tasks/[id]/route.ts`:
  - GET: Returns subtasks, dependencies, and blocked status
  - PATCH: Prevents moving blocked tasks to todo/in_progress; auto-completes parent when all subtasks done
- **Updated** `packages/dashboard/src/app/api/tasks/next/route.ts`:
  - Excludes subtasks and blocked tasks from next task selection
- **Updated** `packages/dashboard/src/components/TaskCard.tsx`:
  - Lock icon for blocked tasks, subtask progress bar (X/Y done)
- **Updated** `packages/dashboard/src/components/TaskModal.tsx`:
  - Shows subtask list with completion checkmarks and dependency info
- **Updated** `packages/dashboard/src/components/KanbanBoard.tsx`:
  - Prevents dragging blocked tasks to active columns
- **Updated** `scripts/orchestrator.ts`:
  - Skips subtasks and blocked tasks in `getProjectTasks()`

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

## Architecture Notes
- No external modal library used - pure React + Tailwind CSS
- Terminal dark theme with CSS custom properties (--terminal-*)
- Custom CSS utility classes: btn-primary, btn-secondary, btn-danger, input-field, card
- Mobile-first responsive design with Tailwind breakpoints (sm: 640px, md: 768px)
- Bottom sheet modal pattern on mobile devices
- Dual card/table layouts for data-heavy views on mobile vs desktop
