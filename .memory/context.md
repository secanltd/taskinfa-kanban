# Project Context

## Last Updated: 2026-02-13

## Recent Changes

### Taskinfa CLI Improvements (feat: taskinfa-cli-improvements)
- **Removed** `taskinfa version` command entirely from `scripts/install.sh`:
  - Deleted `cmd_version()` function
  - Removed from `cmd_usage()` help text
  - Removed from case statement routing
- **Extended** `taskinfa doctor` command with version info:
  - Added `get_installed_version()` helper — extracts version from orchestrator.js binary
  - Added `get_latest_version()` helper — fetches latest release from GitHub API
  - Doctor now shows installed version and latest available version at the top
  - Shows "[!!] Update available! Run: taskinfa update" when versions differ
- **Updated** `taskinfa update` command:
  - Now shows current version before downloading
  - Shows updated version after download completes
- **Cleaned up docs**: Removed `taskinfa version` row from command tables in `README.md` and `docs/WORKER_SETUP.md`

### Workspace Directory - Create Project Form (feat: workspace-directory)
- **Modified** `packages/dashboard/src/components/projects/ProjectsTable.tsx`:
  - Removed "Working Directory" input field (directory is configured during taskinfa CLI install)
  - Made "GitHub Repository URL" required (added `required` attribute and red asterisk)
  - Updated label from "Git Repository URL (Optional)" to "GitHub Repository URL *"
  - Updated placeholder from dual-format to HTTPS-only: `https://github.com/yourorg/repo.git`
  - Updated info text to clarify HTTPS is preferred and SSH is auto-converted
  - Removed `working_directory` from form state (API defaults to `/workspace`)

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
