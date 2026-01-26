# Contributing to Taskinfa-Bot

Thank you for your interest in contributing to Taskinfa-Bot! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, collaborative, and constructive in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/taskinfa-kanban.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit: `git commit -m 'Add some feature'`
7. Push: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start dashboard in dev mode
npm run dashboard:dev

# Run bot (in another terminal)
npm run bot:run
```

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## Pull Request Guidelines

1. **Title**: Use clear, descriptive titles
2. **Description**: Explain what changes you made and why
3. **Tests**: Include tests for new features
4. **Documentation**: Update README if needed
5. **Breaking Changes**: Clearly mark any breaking changes

## Reporting Bugs

Use [GitHub Issues](https://github.com/secanltd/taskinfa-kanban/issues) to report bugs.

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

## Feature Requests

We welcome feature requests! Open an issue with:
- Clear description of the feature
- Use case and motivation
- Proposed implementation (optional)

## Questions?

Feel free to open a discussion or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
