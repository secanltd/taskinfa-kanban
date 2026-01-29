#!/bin/bash

# Taskinfa Worker Loop
# Continuously fetches and executes tasks from the kanban board

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment from .env file
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
else
    echo "ERROR: .env file not found at $SCRIPT_DIR/.env"
    exit 1
fi

# Ensure logs directory exists
mkdir -p "$SCRIPT_DIR/logs"

# Configuration
WORKSPACE_ID="${WORKSPACE_ID:-default}"
TASK_LIST_ID="${TASK_LIST_ID:-default}"
WORKER_NAME="${WORKER_NAME:-Worker-1}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
TASKINFA_API_KEY="${TASKINFA_API_KEY:-}"
TASKINFA_API_URL="${TASKINFA_API_URL:-https://kanban.taskinfa.com/api}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# Workspace directory
WORKSPACE_DIR="$SCRIPT_DIR/workspace"
mkdir -p "$WORKSPACE_DIR"

# Configure Git credentials for private repos
if [ -n "${GITHUB_TOKEN}" ]; then
    echo "Configuring GitHub authentication..."
    git config --global credential.helper store
    echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > "$HOME/.git-credentials"
    chmod 600 "$HOME/.git-credentials"
    git config --global credential.helper "store --file=$HOME/.git-credentials"
    GITHUB_STATUS="Configured"
else
    GITHUB_STATUS="Not configured (public repos only)"
fi

echo "========================================"
echo "   Taskinfa Worker starting..."
echo "========================================"
echo "   Workspace ID: ${WORKSPACE_ID}"
echo "   Task List ID: ${TASK_LIST_ID}"
echo "   Worker Name: ${WORKER_NAME}"
echo "   API URL: ${TASKINFA_API_URL}"
echo "   GitHub Auth: ${GITHUB_STATUS}"
echo "   Working Dir: ${WORKSPACE_DIR}"
echo "========================================"
echo

# Function to fetch next task
fetch_next_task() {
    local response
    response=$(curl -s -X GET \
        "${TASKINFA_API_URL}/tasks?task_list_id=${TASK_LIST_ID}&status=todo&limit=1" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json")

    echo "$response"
}

# Function to update task status
update_task_status() {
    local task_id="$1"
    local status="$2"
    local notes="${3:-}"

    local body="{\"status\": \"${status}\""
    if [ -n "$notes" ]; then
        # Escape quotes in notes
        notes=$(echo "$notes" | sed 's/"/\\"/g' | tr '\n' ' ')
        body="${body}, \"completion_notes\": \"${notes}\""
    fi
    body="${body}}"

    curl -s -X PATCH \
        "${TASKINFA_API_URL}/tasks/${task_id}" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$body"
}

# Function to get task list info (for repo URL)
get_task_list_info() {
    curl -s -X GET \
        "${TASKINFA_API_URL}/task-lists/${TASK_LIST_ID}" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json"
}

# Function to setup project
setup_project() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking project setup..."

    local task_list_info
    task_list_info=$(get_task_list_info)

    local repo_url
    repo_url=$(echo "$task_list_info" | jq -r '.task_list.repository_url // empty')

    if [ -z "$repo_url" ]; then
        echo "   No repository URL configured for this project"
        return 0
    fi

    # Convert SSH URL to HTTPS if needed
    if [[ "$repo_url" == git@github.com:* ]]; then
        repo_url=$(echo "$repo_url" | sed 's|git@github.com:|https://github.com/|')
    fi

    local project_dir="$WORKSPACE_DIR/$TASK_LIST_ID"

    if [ -d "$project_dir/.git" ]; then
        echo "   Project already cloned at $project_dir"
        cd "$project_dir"
        git pull --ff-only 2>/dev/null || echo "   (Could not pull latest changes)"
    else
        echo "   Cloning repository: $repo_url"
        git clone "$repo_url" "$project_dir"
        cd "$project_dir"
        echo "   Project cloned successfully"
    fi
}

# Main loop
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Worker started. Polling every ${POLL_INTERVAL}s..."
echo

# Setup project on first run
setup_project

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for tasks..."

    # Fetch next task
    response=$(fetch_next_task)

    # Check if we got tasks
    task_count=$(echo "$response" | jq -r '.total // 0')

    if [ "$task_count" -eq 0 ]; then
        echo "   No tasks in 'todo' status. Waiting..."
        sleep "${POLL_INTERVAL}"
        continue
    fi

    # Extract task details
    task_id=$(echo "$response" | jq -r '.tasks[0].id')
    task_title=$(echo "$response" | jq -r '.tasks[0].title')
    task_description=$(echo "$response" | jq -r '.tasks[0].description // "No description"')
    task_priority=$(echo "$response" | jq -r '.tasks[0].priority // "medium"')

    echo "   Found task: $task_title"
    echo "   Task ID: $task_id"
    echo "   Priority: $task_priority"
    echo

    # Update status to in_progress
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Claiming task..."
    update_task_status "$task_id" "in_progress" > /dev/null

    # Prepare prompt for Claude
    PROJECT_DIR="$WORKSPACE_DIR/$TASK_LIST_ID"

    CLAUDE_PROMPT="You are an autonomous task worker. Execute the following task:

TASK: ${task_title}

DESCRIPTION:
${task_description}

PRIORITY: ${task_priority}

INSTRUCTIONS:
1. Analyze what needs to be done
2. Make the necessary changes to accomplish the task
3. Test your changes if applicable
4. Provide a summary of what you did

The project is located at: ${PROJECT_DIR}
Work autonomously and complete this task."

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Claude Code session..."

    # Run Claude Code
    SESSION_LOG="$SCRIPT_DIR/logs/session-$(date +%Y%m%d-%H%M%S)-${task_id}.log"

    cd "$PROJECT_DIR" 2>/dev/null || cd "$WORKSPACE_DIR"

    # Run claude with the prompt
    if claude -p "$CLAUDE_PROMPT" --dangerously-skip-permissions 2>&1 | tee "$SESSION_LOG"; then
        echo
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task completed successfully"

        # Get completion notes from last lines of log
        completion_notes="Task completed by ${WORKER_NAME}. See session log for details."

        # Update status to review
        update_task_status "$task_id" "review" "$completion_notes" > /dev/null
        echo "   Status updated to 'review'"
    else
        echo
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task execution had errors"

        # Keep in progress or move back to todo based on error
        update_task_status "$task_id" "todo" "Execution failed. Worker: ${WORKER_NAME}" > /dev/null
        echo "   Status reverted to 'todo'"
    fi

    echo
    echo "   Waiting ${POLL_INTERVAL}s before next check..."
    echo
    sleep "${POLL_INTERVAL}"
done
