# Contributing to Taskinfa Kanban

Thank you for your interest in contributing to Taskinfa Kanban.

## Code of Conduct

Be respectful, collaborative, and constructive in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/taskinfa-kanban.git
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start dashboard in dev mode
npm run dashboard:dev

# Run bot (in another terminal)
cd packages/bot && npm run dev
```

See [docs/SETUP.md](docs/SETUP.md) for complete setup instructions.

## Project Structure

```
taskinfa-kanban/
├── packages/
│   ├── dashboard/      # Next.js app + API + MCP server
│   ├── bot/            # Autonomous task executor
│   └── shared/         # Shared TypeScript types
├── scripts/            # Helper scripts
└── docs/               # Documentation
```

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### TypeScript Guidelines

- Use explicit types, avoid `any`
- Export types from the shared package
- Use async/await over raw Promises
- Handle errors with try/catch blocks

### React Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript interfaces for props

## Testing

```bash
# Run tests (when implemented)
npm test

# Run linter
npm run lint
```

## Pull Request Guidelines

1. **Title**: Use clear, descriptive titles following conventional commits:
   - `feat: Add task filtering by priority`
   - `fix: Resolve login authentication issue`
   - `docs: Update API reference`

2. **Description**: Explain what changes you made and why

3. **Tests**: Include tests for new features

4. **Documentation**: Update docs if needed

5. **Breaking Changes**: Clearly mark any breaking changes

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build/tooling changes

Example:
```
feat: Add task filtering by priority

- Implement priority filter in API endpoint
- Add UI dropdown for priority selection
- Update tests for new filtering logic
```

## Reporting Bugs

Use [GitHub Issues](https://github.com/YOUR_USERNAME/taskinfa-kanban/issues) to report bugs.

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

## Feature Requests

Open an issue with:
- Clear description of the feature
- Use case and motivation
- Proposed implementation (optional)

## Documentation

When adding features:
- Update relevant docs in `docs/`
- Update README.md if needed
- Add JSDoc comments for exported functions

## Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Report security vulnerabilities privately

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open a discussion or reach out to the maintainers.
