#!/bin/bash

# Taskinfa Worker Loop
# Continuously fetches and executes tasks from the kanban board

set -euo pipefail

# Configuration (from environment)
WORKSPACE_ID="${WORKSPACE_ID:-default}"
TASK_LIST_ID="${TASK_LIST_ID:-default}"
WORKER_NAME="${WORKER_NAME:-Worker-1}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
MCP_SERVER_CMD="${MCP_SERVER_CMD:-node}"
MCP_SERVER_ARGS="${MCP_SERVER_ARGS:-/app/mcp/server.js}"

# Claude Code configuration
export CLAUDE_CODE_TASK_LIST_ID="taskinfa-${TASK_LIST_ID}"
export CLAUDE_CODE_ENABLE_TASKS=true

echo "🚀 Taskinfa Worker starting..."
echo "   Workspace: ${WORKSPACE_ID}"
echo "   Task List: ${TASK_LIST_ID}"
echo "   Worker: ${WORKER_NAME}"
echo "   Claude Task List ID: ${CLAUDE_CODE_TASK_LIST_ID}"
echo

# Skill prompt that gets passed to Claude Code
SKILL_PROMPT="
You are working as an autonomous task worker using the taskinfa-kanban skill.

Your mission: Execute tasks for the '${TASK_LIST_ID}' project.

Project Context:
- Task List ID: ${TASK_LIST_ID}
- Worker ID: ${WORKER_NAME}
- Workspace: ${WORKSPACE_ID}

Workflow:
1. Use get_task_list(task_list_id='${TASK_LIST_ID}') to get project info
2. Check if project exists, if not clone repository from task list metadata
3. Use list_tasks(task_list_id='${TASK_LIST_ID}', status='todo') to fetch tasks
4. Claim highest priority task and set status='in_progress'
5. CD into project directory and execute task
6. Mark complete with status='review' and detailed notes
7. Repeat until no more tasks

Begin by checking project status and fetching the next task.
"

# Main loop
while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for tasks..."

    # Start Claude Code session with MCP server
    # The --dangerously-skip-permissions flag gives full autonomy
    # The skill will guide Claude through the task workflow
    claude code \
        --mcp-server "${MCP_SERVER_CMD}" \
        --mcp-server-args "${MCP_SERVER_ARGS}" \
        --dangerously-skip-permissions \
        --prompt "${SKILL_PROMPT}" \
        2>&1 | tee -a "/var/log/worker/session-$(date +%s).log"

    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Session completed successfully"
    else
        echo "⚠️  Session exited with code ${EXIT_CODE}"
    fi

    echo "   Waiting ${POLL_INTERVAL}s before next check..."
    echo
    sleep ${POLL_INTERVAL}
done
