# Project Context

## Last Updated: 2026-02-13

## Recent Changes

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
