#!/bin/bash

# ============================================================================
# Taskinfa Kanban - Local Development Script
# ============================================================================
# This script provides one-command setup for local development with:
# - Prerequisite checks (Node.js, npm, Claude CLI, gh CLI)
# - Automatic dependency installation
# - Intelligent port conflict resolution
# - Auto-generation of .dev.vars configuration
# - Health checks and graceful shutdown
# ============================================================================

# Project Configuration
PROJECT_NAME="Taskinfa Kanban"
DEFAULT_PORT=3000
MIN_NODE_VERSION=18

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get absolute project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print header
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ${PROJECT_NAME} Local Development    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# PREREQUISITE CHECKS
# ============================================================================

check_node_version() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js is not installed${NC}"
        echo -e "${YELLOW}  Please install Node.js ${MIN_NODE_VERSION}+ from https://nodejs.org${NC}"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "$MIN_NODE_VERSION" ]; then
        echo -e "${RED}✗ Node.js version $NODE_VERSION is too old${NC}"
        echo -e "${YELLOW}  Please upgrade to Node.js ${MIN_NODE_VERSION}+ (current: $(node -v))${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
}

check_npm() {
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ npm $(npm -v)${NC}"
}

check_claude_cli() {
    if ! command -v claude &> /dev/null; then
        echo -e "${YELLOW}⚠ Claude CLI not found (optional for orchestrator)${NC}"
        echo -e "${YELLOW}  Install from: https://claude.ai/download${NC}"
    else
        echo -e "${GREEN}✓ Claude CLI installed${NC}"
    fi
}

check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠ GitHub CLI not found (optional for PR workflows)${NC}"
        echo -e "${YELLOW}  Install from: https://cli.github.com${NC}"
    else
        echo -e "${GREEN}✓ GitHub CLI installed${NC}"
    fi
}

echo -e "${CYAN}Checking prerequisites...${NC}"
check_node_version
check_npm
check_claude_cli
check_gh_cli
echo ""

# ============================================================================
# DEPENDENCY INSTALLATION
# ============================================================================

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "${CYAN}Installing dependencies...${NC}"
    cd "$PROJECT_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
    echo ""
fi

# ============================================================================
# PORT MANAGEMENT FUNCTIONS
# ============================================================================

# Check if a port is in use
is_port_in_use() {
    local port=$1
    lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
}

# Get the working directory of process using a port
get_port_process_cwd() {
    local port=$1
    local pid=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null | head -1)

    if [ -z "$pid" ]; then
        echo ""
        return
    fi

    # Get the working directory of the process
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        lsof -p $pid 2>/dev/null | grep cwd | awk '{print $9}'
    else
        # Linux
        readlink -f /proc/$pid/cwd 2>/dev/null
    fi
}

# Check if port is used by this project
is_same_project() {
    local port=$1
    local process_cwd=$(get_port_process_cwd $port)

    if [ -z "$process_cwd" ]; then
        return 1  # Port not in use
    fi

    # Check if the process CWD is within our project directory
    if [[ "$process_cwd" == "$PROJECT_DIR"* ]]; then
        return 0  # Same project
    else
        return 1  # Different project
    fi
}

# Find next available port
find_available_port() {
    local start_port=$1
    local max_attempts=${2:-20}
    local port=$start_port

    for ((i=0; i<$max_attempts; i++)); do
        if ! is_port_in_use $port; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done

    echo ""
    return 1
}

# ============================================================================
# CONFIGURATION FILE GENERATION
# ============================================================================

create_dev_vars_if_missing() {
    local dev_vars_file="$PROJECT_DIR/packages/dashboard/.dev.vars"

    if [ ! -f "$dev_vars_file" ]; then
        echo -e "${CYAN}Creating .dev.vars configuration...${NC}"

        # Generate a random JWT secret
        JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "local-dev-secret-$(date +%s)-change-in-production")

        cat > "$dev_vars_file" << EOF
# Auto-generated by dev.sh - safe for local development
# DO NOT commit this file to git

# Authentication
JWT_SECRET=$JWT_SECRET

# Environment
ENVIRONMENT=development

# Optional: Session configuration
# SESSION_SECRET=$JWT_SECRET
# BCRYPT_ROUNDS=10
# SESSION_MAX_AGE=604800

# These are SAFE DEFAULTS for local development only!
# Real secrets are stored in GitHub Secrets for CI/CD.
EOF

        echo -e "${GREEN}✓ Created .dev.vars with safe defaults${NC}"
        echo ""
    else
        echo -e "${GREEN}✓ .dev.vars already exists${NC}"
        echo ""
    fi
}

create_dev_vars_if_missing

# ============================================================================
# PORT RESOLUTION
# ============================================================================

echo -e "${CYAN}Checking ports...${NC}"

APP_PORT=$DEFAULT_PORT

if is_port_in_use $APP_PORT; then
    if is_same_project $APP_PORT; then
        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║   Dev server already running! ✓        ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${CYAN}Dashboard is running at:${NC} ${GREEN}http://localhost:$APP_PORT${NC}"
        echo ""
        echo -e "${YELLOW}To stop the server, press Ctrl+C in the terminal where it's running.${NC}"
        echo -e "${YELLOW}Or run: pkill -f 'next dev'${NC}"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚠ Port $APP_PORT is in use by another project${NC}"
        APP_PORT=$(find_available_port $(($DEFAULT_PORT + 1)))

        if [ -z "$APP_PORT" ]; then
            echo -e "${RED}✗ Could not find an available port${NC}"
            exit 1
        fi

        echo -e "${CYAN}  Using alternative port: ${APP_PORT}${NC}"
        echo ""
    fi
else
    echo -e "${GREEN}✓ Port $APP_PORT is available${NC}"
    echo ""
fi

# ============================================================================
# START SERVICES
# ============================================================================

echo -e "${CYAN}Starting services...${NC}"
echo ""

# Navigate to dashboard directory
cd "$PROJECT_DIR/packages/dashboard"

# Start Next.js dev server
echo -e "${BLUE}Starting Next.js dashboard on port $APP_PORT...${NC}"
PORT=$APP_PORT npm run dev > "$PROJECT_DIR/.dev-dashboard.log" 2>&1 &
DASHBOARD_PID=$!

# Wait for server to be ready
echo -e "${CYAN}Waiting for server to start...${NC}"
sleep 3

# ============================================================================
# HEALTH CHECKS
# ============================================================================

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/ 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ] || [ "$HTTP_CODE" = "307" ]; then
        echo -e "${GREEN}✓ Dashboard is ready!${NC}"
        echo ""
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Server failed to start${NC}"
    echo -e "${YELLOW}Check logs: tail -f $PROJECT_DIR/.dev-dashboard.log${NC}"
    kill $DASHBOARD_PID 2>/dev/null
    exit 1
fi

# ============================================================================
# SUCCESS MESSAGE
# ============================================================================

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Development server ready!       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Dashboard:${NC}   ${GREEN}http://localhost:$APP_PORT${NC}"
echo -e "${CYAN}Logs:${NC}        ${YELLOW}tail -f $PROJECT_DIR/.dev-dashboard.log${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# ============================================================================
# CLEANUP ON EXIT
# ============================================================================

cleanup() {
    echo ""
    echo -e "${CYAN}Shutting down services...${NC}"

    kill $DASHBOARD_PID 2>/dev/null

    # Clean up log files
    rm -f "$PROJECT_DIR/.dev-dashboard.log"

    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait $DASHBOARD_PID
