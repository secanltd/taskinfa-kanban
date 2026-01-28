#!/bin/bash
# Taskinfa-Kanban Multi-Project Docker Worker
# Fetches highest priority task across ALL projects, executes with Claude Code,
# creates feature branch, pushes, and creates PR

set -euo pipefail

# Configuration from environment variables
WORKER_NAME="${WORKER_NAME:-Worker-1}"
TASKINFA_API_KEY="${TASKINFA_API_KEY:?Error: TASKINFA_API_KEY is required}"
TASKINFA_API_URL="${TASKINFA_API_URL:-https://taskinfa-kanban.secan-ltd.workers.dev/api}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

WORKSPACE_DIR="/workspace"
LOG_DIR="/app/logs"
HEARTBEAT_INTERVAL=10

# Claude Code credentials are mounted from host at ~/.claude

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

# Configure git credentials and identity
configure_git() {
    log_info "Configuring git..."

    # Set git identity
    local worker_lower=$(echo "$WORKER_NAME" | tr '[:upper:]' '[:lower:]')
    git config --global user.email "worker-${worker_lower}@taskinfa.dev"
    git config --global user.name "Taskinfa Worker ${WORKER_NAME}"

    # Configure credentials if GitHub token is provided
    if [ -n "$GITHUB_TOKEN" ]; then
        git config --global credential.helper store
        echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
        chmod 600 ~/.git-credentials

        # Configure gh CLI to use the token
        echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
        log_info "GitHub credentials configured"
    else
        log_warn "No GITHUB_TOKEN - will not be able to push or create PRs"
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
# Note: Log messages go to stderr so they don't pollute the return value
ensure_project() {
    local project_id="$1"
    local repo_url="$2"
    local project_dir="${WORKSPACE_DIR}/${project_id}"

    if [ -d "$project_dir/.git" ]; then
        log_info "Project ${project_id} already cloned, fetching latest..." >&2
        cd "$project_dir" || return 1
        git fetch origin >&2 2>&1 || log_warn "Could not fetch from remote" >&2
        # Reset to main/master to get clean state (redirect all output to stderr)
        { git checkout main || git checkout master || true; } >&2 2>&1
        { git reset --hard origin/main || git reset --hard origin/master || true; } >&2 2>&1
    elif [ -n "$repo_url" ]; then
        log_info "Cloning project ${project_id} from ${repo_url}..." >&2

        # Convert SSH URL to HTTPS if needed
        if [[ "$repo_url" == git@github.com:* ]]; then
            repo_url=$(echo "$repo_url" | sed 's|git@github.com:|https://github.com/|')
        fi

        git clone "$repo_url" "$project_dir" >&2 || {
            log_error "Failed to clone repository" >&2
            return 1
        }
    else
        log_info "No repository URL, creating empty project directory..." >&2
        mkdir -p "$project_dir"
    fi

    echo "$project_dir"
}

# Create feature branch for task
create_feature_branch() {
    local task_id="$1"
    local project_dir="$2"
    local branch_name="task/${task_id}"

    cd "$project_dir"

    # Ensure we're on main/master and up to date
    git fetch origin >&2
    local default_branch
    default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

    # Create and checkout the feature branch
    git checkout -B "$branch_name" "origin/${default_branch}" >&2 || {
        log_error "Failed to create branch ${branch_name}" >&2
        return 1
    }

    log_info "Created branch: ${branch_name}" >&2
    echo "$branch_name"
}

# Push branch and create PR
create_pull_request() {
    local task_id="$1"
    local task_title="$2"
    local task_desc="$3"
    local branch_name="$4"
    local project_dir="$5"

    cd "$project_dir"

    # Check if there are any commits to push
    local default_branch
    default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

    if ! git log "origin/${default_branch}..HEAD" --oneline 2>/dev/null | grep -q .; then
        log_warn "No commits to push" >&2
        echo ""
        return 0
    fi

    # Check if GITHUB_TOKEN is available
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warn "No GITHUB_TOKEN - cannot push or create PR" >&2
        echo ""
        return 0
    fi

    # Push the branch
    log_info "Pushing branch ${branch_name}..." >&2
    if ! git push -u origin "$branch_name" >&2; then
        log_error "Failed to push branch" >&2
        echo ""
        return 1
    fi

    # Create PR
    log_info "Creating pull request..." >&2
    local pr_body="## Task

${task_desc}

---
*Completed by Taskinfa Worker ${WORKER_NAME}*
*Task ID: ${task_id}*"

    local pr_url
    pr_url=$(gh pr create \
        --title "${task_title}" \
        --body "$pr_body" \
        --base "${default_branch}" \
        --head "$branch_name" 2>&1) || true

    if [[ "$pr_url" == https://* ]]; then
        log_success "PR created: ${pr_url}" >&2
        echo "$pr_url"
    else
        log_error "Failed to create PR: ${pr_url}" >&2
        # Still return success since we pushed the branch
        echo "branch:${branch_name}"
    fi
}

# Cleanup branch on failure
cleanup_branch() {
    local branch_name="$1"
    local project_dir="$2"

    cd "$project_dir"

    # Checkout main/master
    git checkout main 2>/dev/null || git checkout master 2>/dev/null || true

    # Delete the failed branch
    git branch -D "$branch_name" 2>/dev/null || true

    log_info "Cleaned up branch: ${branch_name}"
}

# Execute task with Claude Code
execute_task() {
    local task_id="$1"
    local task_title="$2"
    local task_desc="$3"
    local project_dir="$4"
    local branch_name="$5"

    local log_file="${LOG_DIR}/task-${task_id}-$(date '+%Y%m%d-%H%M%S').log"

    # Build Claude prompt
    local prompt="Execute this task autonomously:

TASK: ${task_title}

DESCRIPTION:
${task_desc}

INSTRUCTIONS:
1. You are on branch '${branch_name}' (already created for you)
2. Make all necessary code changes
3. Run tests if applicable
4. Commit your changes with descriptive messages
5. DO NOT push or create a PR - the worker script handles that
6. When done, provide a brief summary of what you did

Working directory: ${project_dir}"

    log_info "Executing task with Claude Code on branch ${branch_name}..."

    cd "$project_dir"

    # Run Claude Code with the prompt
    # Using --dangerously-skip-permissions for autonomous operation
    # Using --model default for automatic Opus/Sonnet switching based on usage
    if claude -p "$prompt" --dangerously-skip-permissions --model default 2>&1 | tee "$log_file"; then
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
    echo "   GitHub: $([ -n "$GITHUB_TOKEN" ] && echo "configured" || echo "NOT configured")"
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

        # Create feature branch (only for git repos)
        branch_name=""
        if [ -d "$project_dir/.git" ] && [ -n "$repo_url" ]; then
            branch_name=$(create_feature_branch "$task_id" "$project_dir")
            if [ -z "$branch_name" ]; then
                log_error "Failed to create feature branch"
                update_task "$task_id" '{"status": "todo", "assigned_to": "", "completion_notes": "Worker '"${WORKER_NAME}"' failed to create branch"}'
                continue
            fi
        fi

        # Execute the task
        if execute_task "$task_id" "$task_title" "$task_desc" "$project_dir" "$branch_name"; then
            log_success "Task completed successfully!"

            # Try to push and create PR (only for git repos with branches)
            if [ -n "$branch_name" ]; then
                pr_result=$(create_pull_request "$task_id" "$task_title" "$task_desc" "$branch_name" "$project_dir")

                if [[ "$pr_result" == https://* ]]; then
                    # PR created successfully
                    update_task "$task_id" "{\"status\": \"review\", \"completion_notes\": \"Completed by ${WORKER_NAME}. PR: ${pr_result}\"}"
                elif [[ "$pr_result" == branch:* ]]; then
                    # Branch pushed but PR creation failed
                    update_task "$task_id" "{\"status\": \"review\", \"completion_notes\": \"Completed by ${WORKER_NAME}. Branch pushed: ${pr_result#branch:}\"}"
                else
                    # No commits or no GitHub token
                    update_task "$task_id" "{\"status\": \"review\", \"completion_notes\": \"Completed by ${WORKER_NAME}. Changes committed locally.\"}"
                fi
            else
                # No git repo - just mark as completed
                update_task "$task_id" "{\"status\": \"review\", \"completion_notes\": \"Completed by ${WORKER_NAME}\"}"
            fi
        else
            log_error "Task execution failed"

            # Cleanup the branch on failure
            if [ -n "$branch_name" ]; then
                cleanup_branch "$branch_name" "$project_dir"
            fi

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
