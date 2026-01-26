# Claude Code Project Rules

This file contains project-specific rules and conventions for Claude Code when working on this repository.

## Git Commit Messages

### ❌ NEVER Add Co-Authored-By Lines
Do NOT add "Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>" or similar attribution lines to commit messages.

**Incorrect:**
```
git commit -m "Add feature

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Correct:**
```
git commit -m "Add feature

Detailed description of changes..."
```

### Commit Message Format
Follow Conventional Commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build/tooling changes

**Example:**
```
feat: Add task filtering by priority

- Implement priority filter in API endpoint
- Add UI dropdown for priority selection
- Update tests for new filtering logic
```

## Code Style

### TypeScript
- Use explicit types, avoid `any` where possible
- Export types from shared package
- Use async/await over raw Promises
- Handle errors with try/catch blocks

### React Components
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript interfaces for props

### File Organization
- Keep related files together
- Use index.ts for clean exports
- Avoid deep nesting (max 3-4 levels)

## Development Workflow

### Before Committing
1. Test changes locally
2. Run linter: `npm run lint`
3. Verify builds: `npm run build`
4. Check for console errors

### When Adding Features
1. Update relevant documentation
2. Add TypeScript types to shared package
3. Update API documentation if endpoints change
4. Consider backward compatibility

### When Fixing Bugs
1. Understand root cause before fixing
2. Add tests to prevent regression
3. Update documentation if behavior changes

## Database Changes

### D1 Migrations
- Always create migration SQL files
- Test migrations locally first
- Document schema changes in comments
- Never delete migration files

**Example:**
```sql
-- Migration: Add task tags feature
-- Date: 2025-01-26

ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';
CREATE INDEX idx_tasks_tags ON tasks(tags);
```

## MCP Server Development

### Tool Definitions
- Keep tool names lowercase with underscores
- Provide clear descriptions
- Document all parameters
- Include examples in comments

### Error Handling
- Return structured error messages
- Use `isError: true` for failures
- Log errors for debugging

## API Development

### REST Endpoints
- Use RESTful conventions
- Return consistent JSON format
- Always validate input
- Include proper HTTP status codes

### Authentication
- Verify JWT on all protected routes
- Check workspace_id matches user's access
- Log authentication failures

## Bot Development

### Execution Loop
- Respect circuit breaker limits
- Log progress clearly
- Handle Claude Code timeouts gracefully
- Clean up resources on exit

### Configuration
- Use environment variables for secrets
- Provide sensible defaults
- Validate configuration on startup

## Testing

### Unit Tests (To Be Implemented)
- Test individual functions in isolation
- Mock external dependencies
- Use descriptive test names

### Integration Tests (To Be Implemented)
- Test API endpoints end-to-end
- Test MCP server tools
- Test database operations

## Documentation

### Code Comments
- Explain WHY, not WHAT
- Document complex algorithms
- Add JSDoc for exported functions
- Keep comments up-to-date

### README Updates
- Keep README in sync with features
- Update examples when APIs change
- Document breaking changes clearly

## Security

### Never Commit
- API keys or secrets
- Database credentials
- JWT secrets
- Personal information

### Best Practices
- Hash API keys before storing
- Use environment variables
- Validate all user input
- Sanitize SQL queries (use parameterized queries)

## Performance

### Database
- Use indexes for frequent queries
- Limit query results
- Cache when appropriate
- Monitor query performance

### Frontend
- Lazy load components when possible
- Optimize bundle size
- Use React.memo for expensive components
- Minimize re-renders

## Deployment

### Before Deploying
- Test in local environment
- Run all builds successfully
- Update environment variables
- Check database migrations

### Cloudflare Pages
- Build with `npm run build`
- Test D1 connections
- Verify environment variables
- Check for CORS issues

## Repository Conventions

### Branch Naming
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

### Pull Requests
- Provide clear description
- Link related issues
- Request reviews when needed
- Update documentation

## Support and Maintenance

### Issue Tracking
- Use GitHub Issues for bugs and features
- Provide reproduction steps
- Include environment details
- Tag appropriately

### Versioning
- Follow Semantic Versioning (SemVer)
- Document changes in releases
- Update package.json versions
- Tag releases in git

---

**Last Updated:** January 26, 2025
**Project:** Taskinfa-Bot
**Repository:** https://github.com/secanltd/taskinfa-kanban
