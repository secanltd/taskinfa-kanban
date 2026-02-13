# Project Context

## Last Updated: 2026-02-13

## Recent Changes

### Merge and Deploy (2026-02-13)
- **Merged** PR #32 (Fix taskinfa update CLI self-update) into main
- **Tagged** `orchestrator/v1.0.5` — triggers release workflow (orchestrator.js + taskinfa-cli.sh)
- **Tagged** `deploy/test/2.0.14` — deploys dashboard to test environment
- **Tagged** `deploy/prod/2.0.14` — deploys dashboard to production environment

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
