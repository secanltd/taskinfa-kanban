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

# Docker image name
IMAGE_NAME="taskinfa-worker"
NETWORK_NAME="taskinfa-workers"

# Default worker
DEFAULT_WORKER="worker-cihan"

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

    # API URL
    export TASKINFA_API_URL="${TASKINFA_API_URL:-https://taskinfa-kanban.secan-ltd.workers.dev/api}"
}

# Validate worker name
validate_worker() {
    local worker="$1"
    if [[ ! "$worker" =~ ^worker- ]]; then
        echo -e "${RED}Error: Worker name must start with 'worker-' (e.g., worker-cihan)${NC}"
        exit 1
    fi
}

# Extract just the name part (worker-cihan -> Cihan)
get_worker_display_name() {
    local worker="$1"
    local name="${worker#worker-}"
    # Capitalize first letter
    echo "$(tr '[:lower:]' '[:upper:]' <<< ${name:0:1})${name:1}"
}

# Ensure Docker image is built
ensure_image() {
    if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
        echo -e "${BLUE}Building Docker image...${NC}"
        docker build -t "$IMAGE_NAME" -f "$PROJECT_DIR/Dockerfile.worker" "$PROJECT_DIR"
    fi
}

# Ensure network exists
ensure_network() {
    if ! docker network inspect "$NETWORK_NAME" &>/dev/null; then
        docker network create "$NETWORK_NAME" &>/dev/null || true
    fi
}

# Commands
cmd_up() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"
    load_env

    local display_name=$(get_worker_display_name "$worker")
    local container="taskinfa-${worker}"

    echo -e "${BLUE}Starting ${worker} (${display_name})...${NC}"

    if [ -z "${TASKINFA_API_KEY:-}" ]; then
        echo -e "${RED}Error: TASKINFA_API_KEY not found in .env${NC}"
        exit 1
    fi

    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
        echo -e "${YELLOW}Warning: Could not extract OAuth token from Keychain${NC}"
        echo -e "${YELLOW}Worker may not be able to authenticate with Claude${NC}"
    fi

    cd "$PROJECT_DIR"

    # Stop existing container if running
    if docker ps -q -f name="$container" | grep -q .; then
        echo -e "${YELLOW}Stopping existing ${worker}...${NC}"
        docker stop "$container" &>/dev/null || true
        docker rm "$container" &>/dev/null || true
    elif docker ps -aq -f name="$container" | grep -q .; then
        docker rm "$container" &>/dev/null || true
    fi

    # Ensure image and network exist
    ensure_image
    ensure_network

    # Create log directory
    mkdir -p "$PROJECT_DIR/logs/${worker#worker-}"

    # Run the container
    docker run -d \
        --name "$container" \
        --hostname "$worker" \
        --network "$NETWORK_NAME" \
        --restart unless-stopped \
        -e "WORKER_NAME=${display_name}" \
        -e "TASKINFA_API_KEY=${TASKINFA_API_KEY}" \
        -e "TASKINFA_API_URL=${TASKINFA_API_URL}" \
        -e "CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN:-}" \
        -e "GITHUB_TOKEN=${GITHUB_TOKEN:-}" \
        -e "POLL_INTERVAL=${POLL_INTERVAL:-30}" \
        -v "${container}-workspace:/workspace" \
        -v "$PROJECT_DIR/logs/${worker#worker-}:/app/logs" \
        -v "$HOME/.claude:/home/worker/.claude" \
        "$IMAGE_NAME"

    echo -e "${GREEN}${worker} started successfully!${NC}"
    echo -e "View logs: ${BLUE}npm run docker:logs ${worker}${NC}"
}

cmd_down() {
    local worker="${1:-$DEFAULT_WORKER}"
    validate_worker "$worker"

    echo -e "${BLUE}Stopping ${worker}...${NC}"

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

    # Find all taskinfa worker containers (running and stopped)
    local found=false
    for container in $(docker ps -a --filter "name=taskinfa-worker-" --format "{{.Names}}" 2>/dev/null); do
        found=true
        local worker="${container#taskinfa-}"
        if docker ps -q -f name="$container" | grep -q .; then
            local status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
            echo -e "${GREEN}●${NC} ${worker}: running"
        else
            echo -e "${RED}○${NC} ${worker}: stopped"
        fi
    done

    if [ "$found" = false ]; then
        echo -e "${YELLOW}No workers found.${NC}"
    fi

    echo ""
    echo -e "${BLUE}Quick Commands:${NC}"
    echo "  npm run docker:up worker-<name>     # Start worker with any name"
    echo "  npm run docker:down worker-<name>   # Stop worker"
    echo "  npm run docker:logs worker-<name>   # View logs"
}

cmd_build() {
    echo -e "${BLUE}Building Docker worker image...${NC}"

    cd "$PROJECT_DIR"
    docker build -t "$IMAGE_NAME" -f Dockerfile.worker .

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

    # Stop and remove all taskinfa worker containers
    for container in $(docker ps -a --filter "name=taskinfa-worker-" --format "{{.Names}}" 2>/dev/null); do
        echo -e "  Removing ${container}..."
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    done

    # Remove network
    docker network rm "$NETWORK_NAME" 2>/dev/null || true

    echo -e "${GREEN}Cleanup complete.${NC}"
}

cmd_help() {
    echo "Docker Worker Management"
    echo ""
    echo "Usage: npm run docker:<command> [worker-name]"
    echo ""
    echo "Commands:"
    echo "  docker:up [worker]      Start a worker (default: worker-cihan)"
    echo "  docker:down [worker]    Stop a worker"
    echo "  docker:restart [worker] Restart a worker"
    echo "  docker:logs [worker]    Follow worker logs"
    echo "  docker:status           Show status of all workers"
    echo "  docker:build            Build/rebuild worker image"
    echo "  docker:shell [worker]   Open bash shell in worker container"
    echo "  docker:clean            Stop all workers and clean up"
    echo ""
    echo "Worker names:"
    echo "  Use any name with 'worker-' prefix: worker-cihan, worker-john, worker-bot1"
    echo "  The name after 'worker-' becomes the display name (capitalized)"
    echo ""
    echo "Examples:"
    echo "  npm run docker:up worker-cihan    # Start worker named 'Cihan'"
    echo "  npm run docker:up worker-bot1     # Start worker named 'Bot1'"
    echo "  npm run docker:logs worker-cihan  # View logs"
    echo "  npm run docker:status             # Show all workers"
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
