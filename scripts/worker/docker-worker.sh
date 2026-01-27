#!/bin/bash
# Taskinfa-Kanban Multi-Project Docker Worker
# Fetches highest priority task across ALL projects and executes with Claude Code

set -euo pipefail

# Configuration from environment variables
WORKER_NAME="${WORKER_NAME:-Worker-1}"
TASKINFA_API_KEY="${TASKINFA_API_KEY:?Error: TASKINFA_API_KEY is required}"
TASKINFA_API_URL="${TASKINFA_API_URL:-https://taskinfa-kanban.secan-ltd.workers.dev/api}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

WORKSPACE_DIR="/workspace"
LOG_DIR="/app/logs"
HEARTBEAT_INTERVAL=10

# Export ANTHROPIC_API_KEY for Claude CLI
export ANTHROPIC_API_KEY

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    log "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# Configure git credentials if GitHub token is provided
configure_git() {
    if [ -n "$GITHUB_TOKEN" ]; then
        log_info "Configuring git credentials..."
        git config --global credential.helper store
        echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
        git config --global user.email "worker@taskinfa-kanban.dev"
        git config --global user.name "Taskinfa Worker ${WORKER_NAME}"
    fi
}

# Send heartbeat to the API
send_heartbeat() {
    local status="${1:-idle}"
    local current_task_id="${2:-}"

    local payload="{\"worker_name\": \"${WORKER_NAME}\", \"status\": \"${status}\""
    if [ -n "$current_task_id" ]; then
        payload="${payload}, \"current_task_id\": \"${current_task_id}\""
    fi
    payload="${payload}}"

    curl -s -X POST "${TASKINFA_API_URL}/workers/heartbeat" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null 2>&1 || true
}

# Fetch next highest priority task across all projects
fetch_next_task() {
    local response
    response=$(curl -s "${TASKINFA_API_URL}/tasks/next" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json")

    echo "$response"
}

# Claim a task (update status to in_progress and assign to this worker)
claim_task() {
    local task_id="$1"

    curl -s -X PATCH "${TASKINFA_API_URL}/tasks/${task_id}" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"status\": \"in_progress\", \"assigned_to\": \"${WORKER_NAME}\"}" > /dev/null
}

# Update task status
update_task() {
    local task_id="$1"
    local payload="$2"

    curl -s -X PATCH "${TASKINFA_API_URL}/tasks/${task_id}" \
        -H "Authorization: Bearer ${TASKINFA_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null
}

# Ensure project repository is cloned and up to date
ensure_project() {
    local project_id="$1"
    local repo_url="$2"
    local project_dir="${WORKSPACE_DIR}/${project_id}"

    if [ -d "$project_dir/.git" ]; then
        log_info "Project ${project_id} already cloned, pulling latest..."
        cd "$project_dir"
        git pull --ff-only 2>/dev/null || log_warn "Could not pull latest changes"
    elif [ -n "$repo_url" ]; then
        log_info "Cloning project ${project_id} from ${repo_url}..."

        # Convert SSH URL to HTTPS if needed
        if [[ "$repo_url" == git@github.com:* ]]; then
            repo_url=$(echo "$repo_url" | sed 's|git@github.com:|https://github.com/|')
        fi

        git clone "$repo_url" "$project_dir" || {
            log_error "Failed to clone repository"
            return 1
        }
    else
        log_info "No repository URL, creating empty project directory..."
        mkdir -p "$project_dir"
    fi

    echo "$project_dir"
}

# Execute task with Claude Code
execute_task() {
    local task_id="$1"
    local task_title="$2"
    local task_desc="$3"
    local project_dir="$4"

    local log_file="${LOG_DIR}/task-${task_id}-$(date '+%Y%m%d-%H%M%S').log"

    # Build Claude prompt
    local prompt="Execute this task autonomously:

TASK: ${task_title}

DESCRIPTION:
${task_desc}

INSTRUCTIONS:
1. Work autonomously to complete the task
2. Make all necessary code changes
3. Run tests if applicable
4. Commit your changes with a descriptive message
5. When done, provide a brief summary of what you did

Work in the current directory: ${project_dir}"

    log_info "Executing task with Claude Code..."

    cd "$project_dir"

    # Run Claude Code with the prompt
    # Using --dangerously-skip-permissions for autonomous operation
    if claude -p "$prompt" --dangerously-skip-permissions 2>&1 | tee "$log_file"; then
        return 0
    else
        return 1
    fi
}

# Background heartbeat sender
start_heartbeat_loop() {
    local task_id="${1:-}"
    local status="${2:-idle}"

    while true; do
        send_heartbeat "$status" "$task_id"
        sleep "$HEARTBEAT_INTERVAL"
    done
}

# Main worker loop
main() {
    echo "========================================"
    echo "   Taskinfa-Kanban Worker: ${WORKER_NAME}"
    echo "========================================"
    echo "   API: ${TASKINFA_API_URL}"
    echo "   Workspace: ${WORKSPACE_DIR}"
    echo "   Poll Interval: ${POLL_INTERVAL}s"
    echo "========================================"
    echo ""

    # Configure git credentials
    configure_git

    # Create directories
    mkdir -p "$LOG_DIR"

    # Send initial heartbeat
    send_heartbeat "idle"

    log_info "Worker started. Polling for tasks..."

    while true; do
        # Send heartbeat
        send_heartbeat "idle"

        log_info "Checking for tasks..."

        # Fetch next task
        response=$(fetch_next_task)
        task_id=$(echo "$response" | jq -r '.task.id // empty')

        if [ -z "$task_id" ] || [ "$task_id" = "null" ]; then
            log_info "No tasks available. Waiting ${POLL_INTERVAL}s..."
            sleep "$POLL_INTERVAL"
            continue
        fi

        # Extract task details
        task_title=$(echo "$response" | jq -r '.task.title // "Untitled"')
        task_desc=$(echo "$response" | jq -r '.task.description // "No description"')
        project_id=$(echo "$response" | jq -r '.project.id // empty')
        project_name=$(echo "$response" | jq -r '.project.name // "Unknown"')
        repo_url=$(echo "$response" | jq -r '.project.repository_url // empty')

        log_success "Found task: ${task_title}"
        log_info "  Project: ${project_name} (${project_id})"
        log_info "  Repository: ${repo_url:-'No repository'}"

        # Claim the task
        log_info "Claiming task..."
        claim_task "$task_id"

        # Update heartbeat to working
        send_heartbeat "working" "$task_id"

        # Ensure project is cloned
        project_dir=$(ensure_project "$project_id" "$repo_url")

        if [ -z "$project_dir" ]; then
            log_error "Failed to setup project directory"
            update_task "$task_id" '{"status": "todo", "assigned_to": "", "completion_notes": "Worker '"${WORKER_NAME}"' failed to setup project"}'
            continue
        fi

        # Execute the task
        if execute_task "$task_id" "$task_title" "$task_desc" "$project_dir"; then
            log_success "Task completed successfully!"
            update_task "$task_id" "{\"status\": \"review\", \"completion_notes\": \"Completed by ${WORKER_NAME}\"}"
        else
            log_error "Task execution failed"
            update_task "$task_id" "{\"status\": \"todo\", \"assigned_to\": \"\", \"completion_notes\": \"Failed execution by ${WORKER_NAME}. Check logs.\"}"
        fi

        # Brief pause before next iteration
        sleep 5
    done
}

# Handle shutdown gracefully
cleanup() {
    log_warn "Received shutdown signal. Cleaning up..."
    send_heartbeat "offline"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Run main loop
main
