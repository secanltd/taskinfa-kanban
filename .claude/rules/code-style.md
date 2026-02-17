# Code Style

## TypeScript

- Explicit types everywhere — no `any`
- `async/await` with `try/catch`
- Functional, immutable patterns preferred

## React

- Functional components only
- Hooks for state and side effects
- Interfaces for all props (not `type`)
- Small, focused components

## Shared Types

- Export from `packages/shared` — not inline in feature code
- Import from `@taskinfa/shared` or the shared package path

## SQL

- Always parameterized queries — no string interpolation
- Document complex queries with SQL comments

## General

- Never commit secrets, credentials, or `.env` files
- Keep imports organized: external → internal → relative
