# API Reference

REST API documentation for Taskinfa Kanban.

## Authentication

All API requests require authentication via Bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

Get your API key from the dashboard: **Settings** → **Generate API Key**

## Base URL

- Local: `http://localhost:3000/api`
- Production: `https://your-instance.workers.dev/api`

## Endpoints

### Tasks

#### List Tasks

```http
GET /api/tasks
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (todo, in_progress, review, done, blocked) |
| `task_list_id` | string | Filter by task list |
| `assigned_to` | string | Filter by assigned worker |

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
      "task_list_id": "default",
      "assigned_to": null,
      "created_at": "2025-01-28T10:00:00Z",
      "updated_at": "2025-01-28T10:00:00Z"
    }
  ]
}
```

#### Create Task

```http
POST /api/tasks
```

Body:
```json
{
  "title": "Add feature X",
  "description": "Implement feature X with tests",
  "priority": "medium",
  "task_list_id": "default"
}
```

Response:
```json
{
  "task": {
    "id": "task_xyz789",
    "title": "Add feature X",
    "status": "todo",
    ...
  }
}
```

#### Get Task

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

#### Update Task

```http
PATCH /api/tasks/:id
```

Body:
```json
{
  "status": "in_progress",
  "assigned_to": "Bot-John"
}
```

#### Delete Task

```http
DELETE /api/tasks/:id
```

Response:
```json
{
  "success": true
}
```

### Task Lists

#### List Task Lists

```http
GET /api/task-lists
```

Response:
```json
{
  "taskLists": [
    {
      "id": "default",
      "name": "Default Project",
      "description": "Main project tasks",
      "repository_url": "https://github.com/org/repo"
    }
  ]
}
```

#### Create Task List

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

### Comments

#### List Comments

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
      "author_name": "Bot-John",
      "created_at": "2025-01-28T10:05:00Z"
    }
  ]
}
```

#### Add Comment

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

Comment Types:
- `progress` - Work progress update
- `question` - Question for human review
- `summary` - Task completion summary
- `error` - Error during execution

### Task Actions

#### Claim Task

Atomically claim a task for a worker.

```http
POST /api/tasks/:id/claim
```

Body:
```json
{
  "bot_name": "Bot-John"
}
```

Response:
```json
{
  "success": true,
  "task": {
    "id": "task_abc123",
    "assigned_to": "Bot-John",
    "status": "in_progress"
  }
}
```

Error (already claimed):
```json
{
  "success": false,
  "error": "Task already claimed"
}
```

#### Get Next Task

Get the next available task to work on.

```http
GET /api/tasks/next
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `task_list_id` | string | Filter by task list |

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

Returns `null` if no tasks available.

### Workspaces

#### Get Current Workspace

```http
GET /api/workspace
```

Response:
```json
{
  "workspace": {
    "id": "default",
    "name": "Default Workspace",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### API Keys

#### List API Keys

```http
GET /api/api-keys
```

Response:
```json
{
  "apiKeys": [
    {
      "id": "key_123",
      "name": "Bot Key",
      "last_used_at": "2025-01-28T10:00:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

Note: Key values are never returned after creation.

#### Create API Key

```http
POST /api/api-keys
```

Body:
```json
{
  "name": "New Bot Key"
}
```

Response:
```json
{
  "apiKey": {
    "id": "key_456",
    "name": "New Bot Key",
    "key": "tk_abc123xyz..."
  }
}
```

**Important**: The `key` is only returned once at creation. Save it securely.

#### Delete API Key

```http
DELETE /api/api-keys/:id
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., task already claimed)
- `500` - Internal Server Error

## Rate Limiting

Default limits:
- 100 requests per minute per API key
- 1000 requests per hour per API key

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706443200
```

## Pagination

List endpoints support pagination:

```http
GET /api/tasks?limit=20&offset=40
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Items per page (max 100) |
| `offset` | number | 0 | Number of items to skip |

Response includes pagination info:
```json
{
  "tasks": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 40
  }
}
```

## Webhooks (Coming Soon)

Subscribe to task events:
- `task.created`
- `task.updated`
- `task.completed`
- `task.claimed`
