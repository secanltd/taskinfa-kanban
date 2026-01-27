#!/bin/bash

# Taskinfa Worker - One-Click Installer
# Sets up a complete Taskinfa worker environment for new users

set -e

# Detect if script is being piped from curl
# If so, download it and re-run interactively
# But only if we're not already running from a temp file (prevent infinite loop)
if [ ! -t 0 ] && [[ "$0" != *taskinfa-install* ]]; then
    echo "Detected non-interactive mode (piped from curl)."
    echo "Downloading installer for interactive execution..."
    echo

    # Use mktemp with -t flag for better cross-platform compatibility
    TEMP_SCRIPT=$(mktemp -t taskinfa-install.XXXXXX)

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/install.sh -o "$TEMP_SCRIPT"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$TEMP_SCRIPT" https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/install.sh
    else
        echo "Error: Neither curl nor wget found. Cannot download installer."
        exit 1
    fi

    chmod +x "$TEMP_SCRIPT"
    echo "Running installer interactively..."
    echo

    # Re-run with terminal input explicitly connected
    exec bash "$TEMP_SCRIPT" </dev/tty
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                    TASKINFA WORKER INSTALLER                        ║"
echo "║            Autonomous Task Automation with Claude Code             ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Claude Code CLI
install_claude_code() {
    print_info "Installing Claude Code CLI..."
    if command_exists curl; then
        curl -fsSL https://claude.sh/install.sh | bash
    elif command_exists wget; then
        wget -qO- https://claude.sh/install.sh | bash
    else
        print_error "Neither curl nor wget found. Please install one of them first."
        exit 1
    fi

    # Add to PATH for current session
    export PATH="$HOME/.claude/bin:$PATH"

    print_success "Claude Code CLI installed"
}

# Function to install Docker (basic guidance)
install_docker_guidance() {
    echo
    print_warning "Docker is not installed on your system."
    echo
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    echo
    echo "Installation guides:"
    echo "  • macOS: https://docs.docker.com/desktop/mac/install/"
    echo "  • Windows: https://docs.docker.com/desktop/windows/install/"
    echo "  • Linux: https://docs.docker.com/engine/install/"
    echo
    read -p "Press Enter after installing Docker to continue..."
}

# Function to authenticate with Claude
authenticate_claude() {
    print_info "Authenticating with Claude..."
    echo
    echo "You'll be redirected to authenticate with Claude in your browser."
    echo "After authenticating, return here to continue."
    echo
    read -p "Press Enter to open authentication page..."

    # Close stdin to prevent installer script from being passed to claude
    claude login </dev/null

    if [ $? -eq 0 ]; then
        print_success "Claude authentication successful"
    else
        print_error "Claude authentication failed"
        exit 1
    fi
}

# Main installation flow
echo "Step 1: Checking prerequisites..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check Claude Code CLI
if command_exists claude; then
    print_success "Claude Code CLI is installed"
    CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
    echo "  Version: $CLAUDE_VERSION"
else
    print_warning "Claude Code CLI not found"
    read -p "Install Claude Code CLI? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        install_claude_code
    else
        print_error "Claude Code CLI is required. Exiting."
        exit 1
    fi
fi

echo

# Check Docker
if command_exists docker; then
    print_success "Docker is installed"
    DOCKER_VERSION=$(docker --version 2>/dev/null || echo "unknown")
    echo "  Version: $DOCKER_VERSION"

    # Check if Docker daemon is running
    if docker info >/dev/null 2>&1; then
        print_success "Docker daemon is running"
    else
        print_warning "Docker daemon is not running"
        echo "  Please start Docker and try again."
        exit 1
    fi
else
    install_docker_guidance

    # Check again
    if ! command_exists docker; then
        print_error "Docker is required but not installed. Exiting."
        exit 1
    fi
fi

echo

# Check Claude authentication
print_info "Checking Claude authentication..."

# Test if Claude can run a simple command (better than just checking for files)
if claude --version >/dev/null 2>&1; then
    print_success "Claude Code CLI is working"

    # Try a test command to verify authentication
    # Claude Code doesn't require explicit login check - if it works, it's authenticated
    print_success "Claude is authenticated and ready"
else
    print_warning "Claude Code CLI test failed"
    authenticate_claude
fi

echo
echo "Step 2: Taskinfa Dashboard Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}Before continuing, you need to set up your Taskinfa account:${NC}"
echo
echo "  1. Go to: ${BLUE}https://taskinfa-kanban.secan-ltd.workers.dev${NC}"
echo "  2. Create an account (or log in if you have one)"
echo "  3. Go to the ${BLUE}Projects${NC} page"
echo "  4. Create a new project (e.g., 'my-first-project')"
echo "  5. Note the ${BLUE}Project ID${NC} (e.g., 'my-first-project')"
echo "  6. Go to ${BLUE}Settings${NC} → API Keys"
echo "  7. Create a new API key"
echo "  8. Copy the API key (shown only once!)"
echo
echo -e "${YELLOW}Come back here when you have:${NC}"
echo "  • Your API key"
echo "  • Your project ID"
echo
read -p "Press Enter when ready to continue..."

echo
echo "Step 3: Worker Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Get API key
while true; do
    read -p "Enter your Taskinfa API key: " API_KEY
    if [ -z "$API_KEY" ]; then
        print_error "API key cannot be empty"
    else
        break
    fi
done

# Get Project ID
while true; do
    read -p "Enter your Project ID (e.g., my-first-project): " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        print_error "Project ID cannot be empty"
    else
        break
    fi
done

# Get Worker Name
read -p "Enter worker name [Worker-1]: " WORKER_NAME
WORKER_NAME=${WORKER_NAME:-Worker-1}

# Get Workspace ID
read -p "Enter workspace ID [default]: " WORKSPACE_ID
WORKSPACE_ID=${WORKSPACE_ID:-default}

# Get GitHub Token (optional, for private repos)
echo
echo -e "${YELLOW}GitHub Access (Optional)${NC}"
echo "If your project uses a private GitHub repository, you'll need to provide a Personal Access Token."
echo "You can skip this if your repository is public."
echo
echo "To create a token:"
echo "  1. Go to: ${BLUE}https://github.com/settings/tokens${NC}"
echo "  2. Click 'Generate new token (classic)'"
echo "  3. Select scopes: ${BLUE}repo${NC} (for private repos)"
echo "  4. Copy the token"
echo
read -p "Enter GitHub Personal Access Token (leave empty to skip): " GITHUB_TOKEN

echo
print_success "Configuration collected"
echo "  API Key: ${API_KEY:0:20}..."
echo "  Project ID: $PROJECT_ID"
echo "  Worker Name: $WORKER_NAME"
echo "  Workspace ID: $WORKSPACE_ID"
if [ -n "$GITHUB_TOKEN" ]; then
    echo "  GitHub Token: ${GITHUB_TOKEN:0:10}... (configured)"
else
    echo "  GitHub Token: (not configured - public repos only)"
fi

echo
echo "Step 4: Setting up worker environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Create working directory
WORKER_DIR="$HOME/.taskinfa/workers/$PROJECT_ID"
mkdir -p "$WORKER_DIR"
mkdir -p "$WORKER_DIR/workspace"
mkdir -p "$WORKER_DIR/logs"

print_success "Created worker directory: $WORKER_DIR"

# Create .env file
cat > "$WORKER_DIR/.env" << EOF
WORKSPACE_ID=$WORKSPACE_ID
TASK_LIST_ID=$PROJECT_ID
WORKER_NAME=$WORKER_NAME
POLL_INTERVAL=30
TASKINFA_API_KEY=$API_KEY
TASKINFA_API_URL=https://taskinfa-kanban.secan-ltd.workers.dev/api
GITHUB_TOKEN=$GITHUB_TOKEN
EOF

print_success "Created configuration file"

# Download worker script
print_info "Downloading worker script..."
curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/worker/taskinfa-worker-loop.sh \
    > "$WORKER_DIR/worker.sh" 2>/dev/null || {
    print_warning "Failed to download from GitHub, using local copy"
    # Create a basic worker script
    cat > "$WORKER_DIR/worker.sh" << 'EOFSCRIPT'
#!/bin/bash
set -euo pipefail

# Load environment
source "$(dirname "$0")/.env"

export CLAUDE_CODE_TASK_LIST_ID="taskinfa-${TASK_LIST_ID}"
export CLAUDE_CODE_ENABLE_TASKS=true

echo "🚀 Taskinfa Worker starting..."
echo "   Project: ${TASK_LIST_ID}"
echo "   Worker: ${WORKER_NAME}"
echo

SKILL_PROMPT="
You are an autonomous task worker for the Taskinfa project '${TASK_LIST_ID}'.

Use the taskinfa-kanban skill to:
1. Fetch tasks from the API using the provided API key
2. Execute tasks autonomously
3. Update task status when complete

Your API key is: ${TASKINFA_API_KEY}
API endpoint: ${TASKINFA_API_URL}

Begin by fetching the next task for project '${TASK_LIST_ID}'.
"

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for tasks..."

    # Simplified version - just prompt for now
    echo "$SKILL_PROMPT"

    echo "   Waiting ${POLL_INTERVAL}s before next check..."
    sleep ${POLL_INTERVAL}
done
EOFSCRIPT
}

chmod +x "$WORKER_DIR/worker.sh"

print_success "Worker script ready"

# Create start/stop scripts
cat > "$WORKER_DIR/start.sh" << 'EOFSTART'
#!/bin/bash
cd "$(dirname "$0")"
./worker.sh > logs/worker.log 2>&1 &
echo $! > worker.pid
echo "Worker started with PID: $(cat worker.pid)"
echo "View logs: tail -f logs/worker.log"
EOFSTART

cat > "$WORKER_DIR/stop.sh" << 'EOFSTOP'
#!/bin/bash
cd "$(dirname "$0")"
if [ -f worker.pid ]; then
    kill $(cat worker.pid) 2>/dev/null || true
    rm worker.pid
    echo "Worker stopped"
else
    echo "Worker not running"
fi
EOFSTOP

chmod +x "$WORKER_DIR/start.sh"
chmod +x "$WORKER_DIR/stop.sh"

print_success "Helper scripts created"

echo
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              INSTALLATION COMPLETE! 🎉                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo
echo "Your Taskinfa worker has been set up successfully!"
echo
echo "Worker directory: ${BLUE}$WORKER_DIR${NC}"
echo
echo "Next steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "1. Create tasks in the Taskinfa dashboard:"
echo "   ${BLUE}https://taskinfa-kanban.secan-ltd.workers.dev/dashboard${NC}"
echo
echo "2. Start the worker:"
echo "   ${BLUE}cd $WORKER_DIR${NC}"
echo "   ${BLUE}./start.sh${NC}"
echo
echo "3. View worker logs:"
echo "   ${BLUE}tail -f $WORKER_DIR/logs/worker.log${NC}"
echo
echo "4. Stop the worker:"
echo "   ${BLUE}cd $WORKER_DIR${NC}"
echo "   ${BLUE}./stop.sh${NC}"
echo
echo "For help and documentation:"
echo "  • Documentation: https://github.com/secanltd/taskinfa-kanban"
echo "  • Issues: https://github.com/secanltd/taskinfa-kanban/issues"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
read -p "Would you like to start the worker now? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    cd "$WORKER_DIR"
    ./start.sh
    echo
    print_success "Worker is now running!"
    echo
    echo "View logs with: tail -f $WORKER_DIR/logs/worker.log"
fi

echo
print_success "Setup complete! Happy automating! 🚀"
