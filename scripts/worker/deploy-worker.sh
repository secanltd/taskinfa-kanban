#!/bin/bash

# Taskinfa Worker Deployment Script
# Quick setup for deploying worker containers

set -euo pipefail

echo "🚀 Taskinfa Worker Deployment"
echo "=============================="
echo

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code CLI not found. Install it:"
    echo "   curl -fsSL https://claude.sh/install.sh | bash"
    exit 1
fi
echo "✅ Claude Code CLI installed"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi
echo "✅ Docker installed"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi
echo "✅ Docker Compose installed"

if [ ! -d "$HOME/.claude" ]; then
    echo "❌ Claude not authenticated. Run: claude login"
    exit 1
fi
echo "✅ Claude authenticated"

echo

# Check if database migration is needed
echo "Database Migration"
echo "------------------"
echo "Have you applied the task lists migration (004_add_task_lists_and_order.sql)?"
echo "If not, run:"
echo "  cd packages/dashboard"
echo "  npx wrangler d1 execute taskinfa-kanban-db --local --file=./migrations/004_add_task_lists_and_order.sql"
echo
read -p "Press Enter to continue or Ctrl+C to exit..."

echo
echo "Build Configuration"
echo "-------------------"

# Ask for project details
read -p "Enter task list ID (e.g., company-website): " TASK_LIST_ID
read -p "Enter workspace ID [default]: " WORKSPACE_ID
WORKSPACE_ID=${WORKSPACE_ID:-default}

read -p "Enter worker name [Worker-1]: " WORKER_NAME
WORKER_NAME=${WORKER_NAME:-Worker-1}

read -p "Enter poll interval in seconds [30]: " POLL_INTERVAL
POLL_INTERVAL=${POLL_INTERVAL:-30}

echo
echo "Building worker container..."
docker-compose -f docker-compose.workers.yml build

echo
echo "Starting worker..."

# Export variables for docker-compose
export WORKSPACE_ID
export TASK_LIST_ID
export WORKER_NAME
export POLL_INTERVAL

docker-compose -f docker-compose.workers.yml up -d "worker-${TASK_LIST_ID}-1"

echo
echo "✅ Worker deployed!"
echo
echo "Monitor logs:"
echo "  docker-compose -f docker-compose.workers.yml logs -f worker-${TASK_LIST_ID}-1"
echo
echo "Access container:"
echo "  docker exec -it worker-${TASK_LIST_ID}-1 bash"
echo
echo "View workspace:"
echo "  ls -la ./workspace-${TASK_LIST_ID}/"
echo
