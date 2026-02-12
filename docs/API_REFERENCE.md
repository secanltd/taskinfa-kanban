# API Reference

REST API documentation for Taskinfa Kanban.

## Authentication

All API requests require authentication. Two methods are supported:

1. **API Key** (Bearer token) — used by the orchestrator and external clients
   ```
   Authorization: Bearer tk_your_api_key_here
   ```

2. **JWT Session** (cookie) — used by the dashboard UI, set automatically on login

Get your API key from the dashboard: **Settings** > **API Keys**.

## Base URL

- Local: `http://localhost:3000`
- Test: `https://taskinfa-kanban-test.secan-ltd.workers.dev`
- Production: `https://kanban.taskinfa.com`

---

## Tasks

### List Tasks

```http
GET /api/tasks
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `backlog`, `todo`, `in_progress`, `review`, `done` |
| `priority` | string | Filter by priority: `low`, `medium`, `high`, `critical` |
| `task_list_id` | string | Filter by project (task list ID) |

Response:
```json
{
  "tasks": [
    {
      "id": "task_abc123",
      "title": "Fix login bug",
      "description": "Login fails with correct credentials",
      "status": "todo",
      "priority": "high",
      "order": 0,
      "task_list_id": "list_xyz",
      "labels": "bug,auth",
      "pr_url": null,
      "pr_branch": null,
      "error_count": 0,
      "workspace_id": "ws_123",
      "created_at": "2026-01-28T10:00:00.000Z",
      "updated_at": "2026-01-28T10:00:00.000Z"
    }
  ]
}
```

### Create Task

```http
POST /api/tasks
```

Body:
```json
{
  "title": "Add feature X",
  "description": "Implement feature X with tests",
  "priority": "medium",
  "task_list_id": "list_xyz"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `title` | Yes | string | Task title |
| `description` | No | string | Task description (used as Claude prompt) |
| `priority` | No | string | `low`, `medium`, `high`, `critical` (default: `medium`) |
| `task_list_id` | Yes | string | Project to add the task to |
| `status` | No | string | Initial status (default: `backlog`) |
| `labels` | No | string | Comma-separated labels |

Response: `201 Created`
```json
{
  "task": {
    "id": "task_xyz789",
    "title": "Add feature X",
    "status": "backlog",
    "priority": "medium",
    ...
  }
}
```

### Get Task

```http
GET /api/tasks/:id
```

Response:
```json
{
  "task": {
    "id": "task_abc123",
    "title": "Fix login bug",
    ...
  }
}
```

### Update Task

```http
PATCH /api/tasks/:id
```

Body (all fields optional):
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "high",
  "order": 1,
  "task_list_id": "list_xyz",
  "labels": "bug,urgent",
  "pr_url": "https://github.com/org/repo/pull/42",
  "pr_branch": "fix/login-bug",
  "notes": "Working on this now",
  "error_count": 0
}
```

Response:
```json
{
  "task": { ... }
}
```

### Delete Task

```http
DELETE /api/tasks/:id
```

Response:
```json
{
  "success": true
}
```

### Get Next Task

Get the highest-priority unassigned `todo` task.

```http
GET /api/tasks/next
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `task_list_id` | string | Filter by project |

Response:
```json
{
  "task": {
    "id": "task_abc123",
    "title": "Highest priority task",
    ...
  }
}
```

Returns `{ "task": null }` if no tasks available.

---

## Task Lists (Projects)

### List Task Lists

```http
GET /api/task-lists
```

Response:
```json
{
  "task_lists": [
    {
      "id": "list_xyz",
      "name": "My Project",
      "description": "Project description",
      "repository_url": "https://github.com/org/repo",
      "working_directory": "/path/to/project",
      "is_initialized": 1,
      "workspace_id": "ws_123",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-28T10:00:00.000Z"
    }
  ]
}
```

### Create Task List

```http
POST /api/task-lists
```

Body:
```json
{
  "name": "New Project",
  "description": "Project description",
  "repository_url": "https://github.com/org/repo"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Project name |
| `description` | No | string | Project description |
| `repository_url` | No | string | GitHub repo URL (for auto-cloning) |

### Get Task List

```http
GET /api/task-lists/:id
```

### Update Task List

```http
PATCH /api/task-lists/:id
```

Body (all fields optional):
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "repository_url": "https://github.com/org/repo",
  "working_directory": "/path/to/project",
  "is_initialized": true
}
```

### Delete Task List

```http
DELETE /api/task-lists/:id
```

Only allowed if the task list has no tasks.

---

## Sessions

Track orchestrator Claude Code sessions.

### List Sessions

```http
GET /api/sessions
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `active`, `completed`, `error` |
| `project_id` | string | Filter by project (task list ID) |

Response:
```json
{
  "sessions": [
    {
      "id": "sess_abc123",
      "task_id": "task_xyz",
      "project_id": "list_xyz",
      "status": "completed",
      "started_at": "2026-01-28T10:00:00.000Z",
      "ended_at": "2026-01-28T10:15:00.000Z",
      "summary": "Created PR #42 fixing the login bug",
      "workspace_id": "ws_123"
    }
  ]
}
```

### Create Session

```http
POST /api/sessions
```

Body:
```json
{
  "task_id": "task_xyz",
  "project_id": "list_xyz"
}
```

Response: `201 Created`
```json
{
  "session": {
    "id": "sess_abc123",
    "status": "active",
    ...
  }
}
```

### Get Session

```http
GET /api/sessions/:id
```

Returns the session with its recent events.

Response:
```json
{
  "session": {
    "id": "sess_abc123",
    "task_id": "task_xyz",
    "project_id": "list_xyz",
    "status": "active",
    "started_at": "2026-01-28T10:00:00.000Z",
    "ended_at": null,
    "summary": null,
    "workspace_id": "ws_123"
  },
  "events": [
    {
      "id": "evt_123",
      "session_id": "sess_abc123",
      "event_type": "tool_use",
      "message": "Editing src/auth/login.ts",
      "created_at": "2026-01-28T10:02:00.000Z"
    }
  ]
}
```

### Update Session

```http
PATCH /api/sessions/:id
```

Body (all fields optional):
```json
{
  "status": "completed",
  "summary": "Fixed login bug, created PR #42",
  "task_id": "task_xyz"
}
```

---

## Events

Log events from orchestrator and Claude hooks.

### List Events

```http
GET /api/events
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Filter by session |
| `task_id` | string | Filter by task |
| `event_type` | string | Filter by event type |

Response:
```json
{
  "events": [
    {
      "id": "evt_123",
      "session_id": "sess_abc123",
      "task_id": "task_xyz",
      "event_type": "tool_use",
      "message": "Reading file src/auth/login.ts",
      "created_at": "2026-01-28T10:02:00.000Z"
    }
  ]
}
```

### Create Event

```http
POST /api/events
```

Body:
```json
{
  "session_id": "sess_abc123",
  "task_id": "task_xyz",
  "event_type": "tool_use",
  "message": "Editing src/auth/login.ts"
}
```

Event types used by the system:
- `session_start` — orchestrator started a Claude session
- `session_end` — session completed
- `tool_use` — Claude used a tool
- `error` — error occurred

Creating an event may trigger Telegram notifications if configured.

---

## Comments

### List Comments

```http
GET /api/tasks/:id/comments
```

Response:
```json
{
  "comments": [
    {
      "id": "comment_123",
      "task_id": "task_abc123",
      "content": "Started working on this task",
      "comment_type": "progress",
      "author_type": "bot",
      "author_name": "orchestrator",
      "created_at": "2026-01-28T10:05:00.000Z"
    }
  ]
}
```

### Add Comment

```http
POST /api/tasks/:id/comments
```

Body:
```json
{
  "content": "Completed initial implementation",
  "comment_type": "progress"
}
```

Comment types: `progress`, `question`, `summary`, `error`

---

## API Keys

### List API Keys

```http
GET /api/keys
```

Response:
```json
{
  "apiKeys": [
    {
      "id": "key_123",
      "name": "Orchestrator Key",
      "last_used_at": "2026-01-28T10:00:00.000Z",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Key values are never returned after creation.

### Create API Key

```http
POST /api/keys
```

Body:
```json
{
  "name": "New Orchestrator Key"
}
```

Response:
```json
{
  "apiKey": {
    "id": "key_456",
    "name": "New Orchestrator Key",
    "key": "tk_abc123xyz..."
  }
}
```

The `key` is only returned once at creation. Save it securely.

### Update API Key

```http
PATCH /api/keys/:id
```

Body:
```json
{
  "name": "Renamed Key"
}
```

### Delete API Key

```http
DELETE /api/keys/:id
```

Soft-deletes (revokes) the key.

---

## Authentication Endpoints

These are used by the dashboard UI and don't require API key auth.

### Sign Up

```http
POST /api/auth/signup
```

Body:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "workspaceName": "My Workspace"
}
```

### Log In

```http
POST /api/auth/login
```

Body:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Sets an httpOnly session cookie on success.

### Log Out

```http
POST /api/auth/logout
```

Clears the session cookie.

### Get Current User

```http
GET /api/auth/me
```

Returns the authenticated user and workspace info.

---

## Workspace

### Get Current Workspace

```http
GET /api/workspace
```

Response:
```json
{
  "workspace": {
    "id": "ws_123",
    "name": "My Workspace",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` — Bad Request (invalid input)
- `401` — Unauthorized (missing or invalid API key / session)
- `404` — Not Found
- `500` — Internal Server Error

## Task Status Flow

Valid status values and their meaning:

```
backlog → todo → in_progress → review → done
                     ^             |
                     |  (retry on  |
                     +-- error) ---+
```

| Status | Description |
|--------|-------------|
| `backlog` | Not yet ready for work |
| `todo` | Ready for the orchestrator to pick up |
| `in_progress` | Currently being worked on by a Claude session |
| `review` | Work complete, PR created, waiting for human review |
| `done` | Task complete and merged |
