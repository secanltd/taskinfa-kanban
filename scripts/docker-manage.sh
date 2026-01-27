#!/bin/bash
# Docker Worker Management Script
# Usage: ./scripts/docker-manage.sh <command> [worker-name]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default worker
DEFAULT_WORKER="worker-john"

# Load environment variables
load_env() {
    if [ -f "$PROJECT_DIR/.env" ]; then
        export TASKINFA_API_KEY=$(grep TASKINFA_API_KEY "$PROJECT_DIR/.env" | cut -d'=' -f2)
    fi

    # Extract OAuth token from macOS Keychain
    if command -v security &> /dev/null; then
        export CLAUDE_CODE_OAUTH_TOKEN=$(security find-generic-password -w -s "Claude Code-credentials" -a "$USER" 2>/dev/null | jq -r '.claudeAiOauth.accessToken' 2>/dev/null || echo "")
    fi

    # Optional: GitHub token for private repos
    if [ -f "$PROJECT_DIR/.env" ] && grep -q GITHUB_TOKEN "$PROJECT_DIR/.env"; then
        export GITHUB_TOKEN=$(grep GITHUB_TOKEN "$PROJECT_DIR/.env" | cut -d'=' -f2)
    fi
}

# Validate worker name
validate_worker() {
    local worker="$1"
    if [[ ! "$worker" =~ ^worker- ]]; then
        echo -e "${RED}Error: Worker name must start with 'worker-' (e.g., worker-john)${NC}"
        exit 1
    fi
}

# Commands
cmd_up() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"
    load_env

    echo -e "${BLUE}Starting ${worker}...${NC}"

    if [ -z "${TASKINFA_API_KEY:-}" ]; then
        echo -e "${RED}Error: TASKINFA_API_KEY not found in .env${NC}"
        exit 1
    fi

    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
        echo -e "${YELLOW}Warning: Could not extract OAuth token from Keychain${NC}"
        echo -e "${YELLOW}Worker may not be able to authenticate with Claude${NC}"
    fi

    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.workers.yml up "$worker" --build -d

    echo -e "${GREEN}${worker} started successfully!${NC}"
    echo -e "View logs: ${BLUE}npm run docker:logs ${worker}${NC}"
}

cmd_down() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"

    echo -e "${BLUE}Stopping ${worker}...${NC}"

    cd "$PROJECT_DIR"
    local container="taskinfa-${worker}"

    if docker ps -q -f name="$container" | grep -q .; then
        docker stop "$container"
        docker rm "$container" 2>/dev/null || true
        echo -e "${GREEN}${worker} stopped.${NC}"
    else
        echo -e "${YELLOW}${worker} is not running.${NC}"
    fi
}

cmd_restart() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"

    echo -e "${BLUE}Restarting ${worker}...${NC}"
    cmd_down "$worker"
    cmd_up "$worker"
}

cmd_logs() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"

    local container="taskinfa-${worker}"

    if docker ps -q -f name="$container" | grep -q .; then
        docker logs -f "$container"
    else
        echo -e "${YELLOW}${worker} is not running.${NC}"
        echo -e "Start it with: ${BLUE}npm run docker:up ${worker}${NC}"
    fi
}

cmd_status() {
    echo -e "${BLUE}Docker Worker Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    cd "$PROJECT_DIR"

    # Check each worker
    for worker in worker-john worker-sarah worker-mike; do
        local container="taskinfa-${worker}"
        if docker ps -q -f name="$container" | grep -q .; then
            local status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
            local health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "")
            echo -e "${GREEN}●${NC} ${worker}: running ${health:+(${health})}"
        else
            echo -e "${RED}○${NC} ${worker}: stopped"
        fi
    done

    echo ""
    echo -e "${BLUE}Quick Commands:${NC}"
    echo "  npm run docker:up worker-john     # Start worker"
    echo "  npm run docker:down worker-john   # Stop worker"
    echo "  npm run docker:logs worker-john   # View logs"
}

cmd_build() {
    echo -e "${BLUE}Building Docker worker image...${NC}"

    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.workers.yml build

    echo -e "${GREEN}Build complete!${NC}"
}

cmd_shell() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"

    local container="taskinfa-${worker}"

    if docker ps -q -f name="$container" | grep -q .; then
        echo -e "${BLUE}Opening shell in ${worker}...${NC}"
        docker exec -it "$container" /bin/bash
    else
        echo -e "${YELLOW}${worker} is not running.${NC}"
        echo -e "Start it with: ${BLUE}npm run docker:up ${worker}${NC}"
    fi
}

cmd_clean() {
    echo -e "${YELLOW}Cleaning up Docker resources...${NC}"

    cd "$PROJECT_DIR"

    # Stop all workers
    for worker in worker-john worker-sarah worker-mike; do
        local container="taskinfa-${worker}"
        if docker ps -q -f name="$container" | grep -q .; then
            docker stop "$container" 2>/dev/null || true
        fi
        docker rm "$container" 2>/dev/null || true
    done

    # Remove network
    docker network rm taskinfa-bot_taskinfa-workers 2>/dev/null || true

    echo -e "${GREEN}Cleanup complete.${NC}"
}

cmd_help() {
    echo "Docker Worker Management"
    echo ""
    echo "Usage: npm run docker:<command> [worker-name]"
    echo ""
    echo "Commands:"
    echo "  docker:up [worker]      Start a worker (default: worker-john)"
    echo "  docker:down [worker]    Stop a worker"
    echo "  docker:restart [worker] Restart a worker"
    echo "  docker:logs [worker]    Follow worker logs"
    echo "  docker:status           Show status of all workers"
    echo "  docker:build            Build/rebuild worker image"
    echo "  docker:shell [worker]   Open bash shell in worker container"
    echo "  docker:clean            Stop all workers and clean up"
    echo ""
    echo "Workers:"
    echo "  worker-john   Primary worker"
    echo "  worker-sarah  Secondary worker (multi-worker profile)"
    echo "  worker-mike   Tertiary worker (multi-worker profile)"
    echo ""
    echo "Examples:"
    echo "  npm run docker:up worker-john"
    echo "  npm run docker:logs worker-sarah"
    echo "  npm run docker:status"
}

# Main
command="${1:-help}"
worker="${2:-}"

case "$command" in
    up)      cmd_up "$worker" ;;
    down)    cmd_down "$worker" ;;
    restart) cmd_restart "$worker" ;;
    logs)    cmd_logs "$worker" ;;
    status)  cmd_status ;;
    build)   cmd_build ;;
    shell)   cmd_shell "$worker" ;;
    clean)   cmd_clean ;;
    help)    cmd_help ;;
    *)
        echo -e "${RED}Unknown command: $command${NC}"
        cmd_help
        exit 1
        ;;
esac
