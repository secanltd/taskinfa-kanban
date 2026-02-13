# Project Context

## Last Updated: 2026-02-13

## Recent Changes

### Task Error Counts (feat: task-error-counts)
- **Added** error count badge to `TaskCard.tsx`:
  - Shows amber badge for 1-2 errors, red badge for 3+ errors
  - Displays "{count} error(s)" text
- **Added** error count panel to `TaskModal.tsx`:
  - Shows warning panel with error count when `error_count > 0`
  - Indicates when task will be skipped by orchestrator (>= 3 errors)
  - "Reset" button resets `error_count` to 0 via PATCH `/api/tasks/{id}`
  - After reset, task will no longer be skipped on next orchestrator poll

### Taskinfa CLI Improvements (feat: taskinfa-cli-improvements)
- **Removed** `taskinfa version` command entirely from `scripts/install.sh`
- **Extended** `taskinfa doctor` command with version info
- **Updated** `taskinfa update` command with version display

### Workspace Directory - Create Project Form (feat: workspace-directory)
- Removed "Working Directory" input field from project creation
- Made "GitHub Repository URL" required

### Global Modal Component (feat: global-modal-component)
- Created reusable `Modal`, `ModalHeader`, `ModalFooter` components
- Refactored `CreateTaskModal`, `TaskModal`, `ApiKeyCreateDialog` to use shared Modal

## Architecture Notes
- No external modal library used - pure React + Tailwind CSS
- Terminal dark theme with CSS custom properties (--terminal-*)
- Custom CSS utility classes: btn-primary, btn-secondary, btn-danger, input-field, card
- Error count logic: orchestrator increments `error_count` on failed sessions, skips tasks when `error_count >= MAX_RETRIES` (default 3)
