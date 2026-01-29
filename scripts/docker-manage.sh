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
DEFAULT_WORKER="cihan"

# Normalize worker name for env vars: dev-alice → DEV_ALICE
normalize_name() {
    echo "$1" | tr '[:lower:]-' '[:upper:]_'
}

# Capitalize first letter for display: dev-alice → Dev-alice
capitalize_name() {
    echo "$(tr '[:lower:]' '[:upper:]' <<< ${1:0:1})${1:1}"
}

# Load environment variables for a specific worker
load_env() {
    local worker_name="${1:-}"

    # Extract OAuth token from macOS Keychain (shared across workers)
    if command -v security &> /dev/null; then
        export CLAUDE_CODE_OAUTH_TOKEN=$(security find-generic-password -w -s "Claude Code-credentials" -a "$USER" 2>/dev/null | jq -r '.claudeAiOauth.accessToken' 2>/dev/null || echo "")
    fi

    # Load per-worker credentials
    if [ -n "$worker_name" ]; then
        local worker_suffix=$(normalize_name "$worker_name")

        # Per-worker API URL (falls back to shared TASKINFA_API_URL, then default)
        local api_url_var="TASKINFA_API_URL_${worker_suffix}"
        if [ -f "$PROJECT_DIR/.env" ] && grep -q "^${api_url_var}=" "$PROJECT_DIR/.env"; then
            export TASKINFA_API_URL=$(grep "^${api_url_var}=" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        else
            export TASKINFA_API_URL="${TASKINFA_API_URL:-https://kanban.taskinfa.com/api}"
        fi

        # Per-worker Taskinfa API key
        local api_key_var="TASKINFA_API_KEY_${worker_suffix}"
        if [ -f "$PROJECT_DIR/.env" ] && grep -q "^${api_key_var}=" "$PROJECT_DIR/.env"; then
            export TASKINFA_API_KEY=$(grep "^${api_key_var}=" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        else
            echo -e "${RED}Error: ${api_key_var} not found in .env${NC}"
            echo "Run: npm run docker:setup ${worker_name}"
            exit 1
        fi

        # Per-worker GitHub token
        local github_var="GITHUB_TOKEN_${worker_suffix}"
        if [ -f "$PROJECT_DIR/.env" ] && grep -q "^${github_var}=" "$PROJECT_DIR/.env"; then
            export GITHUB_TOKEN=$(grep "^${github_var}=" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        else
            echo -e "${YELLOW}Warning: ${github_var} not found - worker cannot push/create PRs${NC}"
        fi
    fi
}

# Validate worker name (any alphanumeric name with hyphens/underscores allowed)
validate_worker() {
    local worker="$1"
    if [ -z "$worker" ]; then
        echo -e "${RED}Error: Worker name is required${NC}"
        echo "Usage: npm run docker:<command> <worker-name>"
        echo "Examples: npm run docker:up cihan"
        echo "          npm run docker:up dev-alice"
        echo "          npm run docker:up bot-1"
        exit 1
    fi
    if [[ ! "$worker" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo -e "${RED}Error: Worker name must be alphanumeric (hyphens and underscores allowed)${NC}"
        exit 1
    fi
}

# Get display name (cihan -> Cihan, dev-alice -> Dev-alice)
get_worker_display_name() {
    local worker="$1"
    capitalize_name "$worker"
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
    load_env "$worker"

    local display_name=$(get_worker_display_name "$worker")
    local container="taskinfa-${worker}"

    echo -e "${BLUE}Starting ${worker} (${display_name})...${NC}"

    if [ -z "${TASKINFA_API_KEY:-}" ]; then
        echo -e "${RED}Error: TASKINFA_API_KEY not found for worker '${worker}'${NC}"
        echo "Run: npm run docker:setup ${worker}"
        exit 1
    fi

    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
        echo -e "${YELLOW}Warning: Could not extract OAuth token from Keychain${NC}"
        echo -e "${YELLOW}Worker may not be able to authenticate with Claude${NC}"
    fi

    if [ -z "${GITHUB_TOKEN:-}" ]; then
        echo -e "${YELLOW}Warning: GITHUB_TOKEN not found for worker '${worker}'${NC}"
        echo -e "${YELLOW}Worker will not be able to push commits or create PRs${NC}"
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
    mkdir -p "$PROJECT_DIR/logs/${worker}"

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
        -v "$PROJECT_DIR/logs/${worker}:/app/logs" \
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

cmd_setup() {
    local worker="${1:-}"

    if [ -z "$worker" ]; then
        echo -e "${RED}Error: Worker name required${NC}"
        echo "Usage: npm run docker:setup <name>"
        echo "Examples: npm run docker:setup cihan"
        echo "          npm run docker:setup dev-alice"
        echo "          npm run docker:setup bot-1"
        exit 1
    fi

    validate_worker "$worker"

    local display_name=$(capitalize_name "$worker")
    local worker_suffix=$(normalize_name "$worker")
    local api_key_var="TASKINFA_API_KEY_${worker_suffix}"
    local github_token_var="GITHUB_TOKEN_${worker_suffix}"

    echo ""
    echo -e "${BLUE}Docker Worker Setup: ${display_name}${NC}"
    echo "========================================"
    echo ""

    # Ensure .env file exists
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        touch "$PROJECT_DIR/.env"
    fi

    # --- Taskinfa API Key ---
    echo -e "${BLUE}Step 1: Taskinfa API Key${NC}"
    echo "Each worker needs its own API key for task access control."
    echo ""

    if grep -q "^${api_key_var}=" "$PROJECT_DIR/.env" 2>/dev/null; then
        echo -e "${GREEN}✓ ${api_key_var} already configured${NC}"
        read -p "Update it? (y/N): " update_api
        if [[ "$update_api" == "y" || "$update_api" == "Y" ]]; then
            echo ""
            echo "Create a new API key in the Taskinfa dashboard:"
            echo "  → Settings → API Keys → Create Key → Name: '${worker}'"
            echo ""
            read -sp "Enter Taskinfa API key for ${worker}: " api_key
            echo ""
            # Use a different delimiter for sed since API keys might contain /
            sed -i '' "s|^${api_key_var}=.*|${api_key_var}=${api_key}|" "$PROJECT_DIR/.env"
            echo -e "${GREEN}✓ ${api_key_var} updated${NC}"
        fi
    else
        echo "Create an API key in the Taskinfa dashboard:"
        echo "  → Settings → API Keys → Create Key → Name: '${worker}'"
        echo ""
        read -sp "Enter Taskinfa API key for ${worker}: " api_key
        echo ""
        if [ -z "$api_key" ]; then
            echo -e "${RED}No API key provided. Aborting.${NC}"
            exit 1
        fi
        echo "${api_key_var}=${api_key}" >> "$PROJECT_DIR/.env"
        echo -e "${GREEN}✓ ${api_key_var} saved${NC}"
    fi

    echo ""

    # --- GitHub Token ---
    echo -e "${BLUE}Step 2: GitHub Token${NC}"
    echo "For cloning repos and creating PRs."
    echo ""

    if grep -q "^${github_token_var}=" "$PROJECT_DIR/.env" 2>/dev/null; then
        echo -e "${GREEN}✓ ${github_token_var} already configured${NC}"
        read -p "Update it? (y/N): " update_gh
        if [[ "$update_gh" == "y" || "$update_gh" == "Y" ]]; then
            echo ""
            echo "Create token at: https://github.com/settings/tokens/new"
            echo "Required scopes: repo (full control)"
            echo ""
            read -sp "Enter GitHub token for ${worker}: " gh_token
            echo ""
            sed -i '' "s|^${github_token_var}=.*|${github_token_var}=${gh_token}|" "$PROJECT_DIR/.env"
            echo -e "${GREEN}✓ ${github_token_var} updated${NC}"
        fi
    else
        local worker_lower=$(echo "$worker" | tr '[:upper:]' '[:lower:]')
        echo "Option 1: Create a GitHub account for this worker (recommended)"
        echo "          e.g., 'taskinfa-worker-${worker_lower}'"
        echo ""
        echo "Option 2: Use your personal token (all workers show as you)"
        echo ""
        echo "Create token at: https://github.com/settings/tokens/new"
        echo "Required scopes: repo (full control)"
        echo ""
        read -sp "Enter GitHub token for ${worker}: " gh_token
        echo ""
        if [ -z "$gh_token" ]; then
            echo -e "${RED}No GitHub token provided. Aborting.${NC}"
            exit 1
        fi
        echo "${github_token_var}=${gh_token}" >> "$PROJECT_DIR/.env"
        echo -e "${GREEN}✓ ${github_token_var} saved${NC}"
    fi

    echo ""

    # --- Kanban Board URL ---
    echo -e "${BLUE}Step 3: Kanban Board URL${NC}"
    echo "The bot polls this URL every 30 seconds to fetch and claim tasks."
    echo "If you use kanban.taskinfa.com, just press Enter to keep the default."
    echo "If you run the board locally or on your own Cloudflare account,"
    echo "enter your custom URL (e.g. http://localhost:3000/api)."
    echo ""

    local api_url_var="TASKINFA_API_URL_${worker_suffix}"
    local default_api_url="https://kanban.taskinfa.com/api"

    if grep -q "^${api_url_var}=" "$PROJECT_DIR/.env" 2>/dev/null; then
        local current_url=$(grep "^${api_url_var}=" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        echo -e "${GREEN}✓ ${api_url_var} already configured: ${current_url}${NC}"
        read -p "Update it? (y/N): " update_url
        if [[ "$update_url" == "y" || "$update_url" == "Y" ]]; then
            read -p "Enter Kanban board API URL [${default_api_url}]: " api_url
            api_url="${api_url:-$default_api_url}"
            sed -i '' "s|^${api_url_var}=.*|${api_url_var}=${api_url}|" "$PROJECT_DIR/.env"
            echo -e "${GREEN}✓ ${api_url_var} updated${NC}"
        fi
    else
        read -p "Enter Kanban board API URL [${default_api_url}]: " api_url
        api_url="${api_url:-$default_api_url}"
        echo "${api_url_var}=${api_url}" >> "$PROJECT_DIR/.env"
        echo -e "${GREEN}✓ ${api_url_var} saved${NC}"
    fi

    echo ""
    echo -e "${GREEN}Setup complete for ${display_name}!${NC}"
    echo ""
    echo "Start the worker:"
    echo -e "  ${BLUE}npm run docker:up ${worker}${NC}"
}

cmd_status() {
    echo -e "${BLUE}Docker Worker Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Find all taskinfa worker containers (running and stopped)
    local found=false
    for container in $(docker ps -a --filter "name=taskinfa-" --format "{{.Names}}" 2>/dev/null | grep -v "taskinfa-workers"); do
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
    echo "  npm run docker:setup <name>    # Setup credentials for a worker"
    echo "  npm run docker:up <name>       # Start worker"
    echo "  npm run docker:down <name>     # Stop worker"
    echo "  npm run docker:logs <name>     # View logs"
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
    for container in $(docker ps -a --filter "name=taskinfa-" --format "{{.Names}}" 2>/dev/null | grep -v "taskinfa-workers"); do
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
    echo "  docker:setup <name>     Setup credentials for a new worker (REQUIRED first)"
    echo "  docker:up [name]        Start a worker (default: cihan)"
    echo "  docker:down [name]      Stop a worker"
    echo "  docker:restart [name]   Restart a worker"
    echo "  docker:logs [name]      Follow worker logs"
    echo "  docker:status           Show status of all workers"
    echo "  docker:build            Build/rebuild worker image"
    echo "  docker:shell [name]     Open bash shell in worker container"
    echo "  docker:clean            Stop all workers and clean up"
    echo ""
    echo "Worker names:"
    echo "  Use any alphanumeric name: cihan, dev-alice, bot-1"
    echo "  The name is used for:"
    echo "    - Container name: taskinfa-<name>"
    echo "    - Env vars: TASKINFA_API_KEY_<NAME>, GITHUB_TOKEN_<NAME>"
    echo "    - Git identity: Taskinfa Worker <Name>"
    echo ""
    echo "First-time setup:"
    echo "  npm run docker:setup cihan        # Setup API key + GitHub token"
    echo "  npm run docker:up cihan           # Start worker"
    echo ""
    echo "Examples:"
    echo "  npm run docker:setup dev-alice    # Setup new worker 'dev-alice'"
    echo "  npm run docker:up cihan           # Start worker named 'Cihan'"
    echo "  npm run docker:logs bot-1         # View logs for 'bot-1'"
    echo "  npm run docker:status             # Show all workers"
}

# Main
command="${1:-help}"
worker="${2:-}"

case "$command" in
    setup)   cmd_setup "$worker" ;;
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
