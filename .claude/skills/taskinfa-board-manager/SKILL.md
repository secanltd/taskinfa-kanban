---
name: taskinfa-board-manager
description: Create, update, and query tasks on the Taskinfa Kanban board. Manage tasks across projects directly from Claude Code.
disable-model-invocation: true
user-invocable: true
argument-hint: "<action> [details]"
allowed-tools: Bash, Read
---

# Taskinfa Board Manager

Manage tasks on the Taskinfa Kanban board. Parse `$ARGUMENTS` to determine the action and details.

## Step 0: Load API configuration

Read the Taskinfa config to get the API URL and key:

```bash
# Try environment variables first, then config file
if [ -z "$KANBAN_API_URL" ] || [ -z "$KANBAN_API_KEY" ]; then
  CONFIG_FILE="${TASKINFA_HOME:-/workspace/.taskinfa-kanban}/config.env"
  if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
  else
    echo "ERROR: Taskinfa config not found at $CONFIG_FILE"
    echo "Run 'taskinfa auth' to configure API access, or set KANBAN_API_URL and KANBAN_API_KEY environment variables."
    exit 1
  fi
fi
```

Verify connectivity:

```bash
curl -sf "$KANBAN_API_URL/api/task-lists" \
  -H "Authorization: Bearer $KANBAN_API_KEY" > /dev/null \
  || { echo "ERROR: Cannot reach Taskinfa API at $KANBAN_API_URL. Check your config."; exit 1; }
```

## Step 1: Determine the action

Parse `$ARGUMENTS` to identify the operation. The user's request is natural language. Classify it as one of:

- **create** — User wants to create one or more tasks (keywords: "create", "add", "new task")
- **update** — User wants to modify an existing task (keywords: "update", "move", "change", "set", "mark")
- **list** — User wants to view/search tasks (keywords: "list", "show", "find", "what tasks", "query")

---

## Action: Create Tasks

### 1a: Fetch available projects

Get the list of projects so you can match the user's request to the right `task_list_id`:

```bash
curl -s "$KANBAN_API_URL/api/task-lists" \
  -H "Authorization: Bearer $KANBAN_API_KEY" | jq '.task_lists[] | {id, name, repository_url}'
```

If the user specifies a project name, match it (case-insensitive, partial match is fine). If they don't specify a project and there are multiple, ask which project to use.

### 1b: Create the task(s)

For each task, send a POST request:

```bash
curl -s -X POST "$KANBAN_API_URL/api/tasks" \
  -H "Authorization: Bearer $KANBAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Short, actionable title",
    "task_list_id": "<project_id>",
    "priority": "medium",
    "description": "Markdown description with context, deliverables, and technical notes",
    "labels": ["label1", "label2"]
  }'
```

**Required fields**: `title`, `task_list_id`
**Optional fields**: `description`, `priority` (low/medium/high/urgent, default: medium), `labels` (string array)

The new task is created with `status: backlog` by default.

### 1c: Write quality descriptions

When the user provides enough context, write task descriptions like a senior engineer:

```markdown
## Overview
[1-2 sentences explaining what this task accomplishes and why]

## Deliverables
- [ ] Specific deliverable 1
- [ ] Specific deliverable 2

## Technical Notes
- Implementation hints, relevant files, or constraints
- Links to related code or documentation
```

If the user only provides a short phrase, use that as the title and keep the description brief or omit it.

### 1d: Confirm creation

After creating, output a summary:

```
Created task: <task_id>
  Title: <title>
  Project: <project_name>
  Priority: <priority>
  Status: backlog
```

If multiple tasks were created, list all of them.

---

## Action: Update Tasks

### 2a: Find the task

If the user provides a task ID (e.g., `task_abc123`), use it directly:

```bash
curl -s "$KANBAN_API_URL/api/tasks/<task_id>" \
  -H "Authorization: Bearer $KANBAN_API_KEY"
```

If the user describes the task by name, search for it:

```bash
curl -s "$KANBAN_API_URL/api/tasks?task_list_id=<project_id>&limit=100" \
  -H "Authorization: Bearer $KANBAN_API_KEY" | jq '.tasks[] | {id, title, status, priority}'
```

Match the user's description to a task title. If ambiguous, show the candidates and ask the user to pick.

### 2b: Apply the update

```bash
curl -s -X PATCH "$KANBAN_API_URL/api/tasks/<task_id>" \
  -H "Authorization: Bearer $KANBAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "priority": "high",
    "title": "Updated title",
    "description": "Updated description",
    "labels": ["updated-label"]
  }'
```

**Updatable fields**: `title`, `description`, `status`, `priority`, `labels`, `pr_url`, `branch_name`, `completion_notes`, `assigned_to`, `files_changed`, `error_count`

**Valid statuses**: `backlog`, `todo`, `in_progress`, `review`, `done`
**Valid priorities**: `low`, `medium`, `high`, `urgent`

Common update patterns:
- "move task X to in_progress" → `{"status": "in_progress"}`
- "mark task X as done" → `{"status": "done"}`
- "set priority to urgent" → `{"priority": "urgent"}`
- "add label 'frontend'" → fetch current labels, append, then `{"labels": [...]}`

### 2c: Confirm update

Output what changed:

```
Updated task: <task_id>
  Title: <title>
  Changes: status backlog → in_progress, priority medium → high
```

---

## Action: List/Query Tasks

### 3a: Fetch tasks with filters

```bash
# List all tasks in a project
curl -s "$KANBAN_API_URL/api/tasks?task_list_id=<project_id>&limit=50" \
  -H "Authorization: Bearer $KANBAN_API_KEY"

# Filter by status
curl -s "$KANBAN_API_URL/api/tasks?status=backlog&limit=50" \
  -H "Authorization: Bearer $KANBAN_API_KEY"

# Filter by priority
curl -s "$KANBAN_API_URL/api/tasks?priority=high&limit=50" \
  -H "Authorization: Bearer $KANBAN_API_KEY"

# Combine filters
curl -s "$KANBAN_API_URL/api/tasks?task_list_id=<id>&status=todo&priority=urgent&limit=50" \
  -H "Authorization: Bearer $KANBAN_API_KEY"
```

**Available filters**: `task_list_id`, `status`, `priority`, `limit` (1-100, default 50)

If the user asks about a specific project, first fetch task lists to find the `task_list_id`:

```bash
curl -s "$KANBAN_API_URL/api/task-lists" \
  -H "Authorization: Bearer $KANBAN_API_KEY" | jq '.task_lists[] | {id, name}'
```

### 3b: Display results

Format the results as a readable table or list:

```
Tasks in <project_name> (status: backlog):

  ID              | Priority | Title
  --------------- | -------- | -----
  task_abc123     | high     | Fix login redirect bug
  task_def456     | medium   | Add email verification
  task_ghi789     | low      | Update README

Total: 3 tasks
```

Include additional details when relevant:
- `assigned_to` — if someone is working on it
- `pr_url` — if a PR exists
- `error_count` — if > 0 (task may be blocked)
- `labels` — if the task has labels

For single-task queries, show the full task details including description.

---

## Error Handling

- If the API returns an error, show the HTTP status code and error message
- If a task ID is not found, say so and suggest searching by name
- If no tasks match a query, say "No tasks found matching your criteria"
- If creating a task fails due to missing fields, explain what's required
- If the config file is missing, tell the user to run `taskinfa auth` or set environment variables

## Important Notes

- Always load config from `config.env` or environment variables — never hardcode API URLs or keys
- When creating multiple tasks from a single request, create them one at a time and report each result
- Use `jq` for JSON parsing in curl responses
- When the user's project name is ambiguous, fetch the task lists and ask them to clarify
- Task IDs look like `task_...` — if the user provides one, use it directly
- Status transitions set timestamps automatically: `in_progress` sets `started_at`, `done`/`review` sets `completed_at`
