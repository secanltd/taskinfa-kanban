#!/bin/bash

# ============================================================================
# Taskinfa Kanban — Local Development Script
# ============================================================================
# One-command full-stack local development setup:
#
#   Phase 1  Prerequisites check
#   Phase 2  Dependency installation
#   Phase 3  Port resolution (early-exit if already running)
#   Phase 4  Local D1 database reset + migrations
#   Phase 5  Dashboard config (.dev.vars)
#   Phase 6  Start Next.js dashboard
#   Phase 7  Health check (wait for server ready)
#   Phase 8  Seed DB (dev user + API key via live API)
#   Phase 9  Write orchestrator .env with live API key + local URL
#   Phase 10 Start orchestrator (optional, polls every 10s locally)
#   Phase 11 Print full dev summary
#
# Usage:
#   ./dev.sh                   Start dashboard + orchestrator (default)
#   ./dev.sh --no-orchestrator Start dashboard only
#
# Workflow for contributors:
#   git pull origin main && ./dev.sh
# ============================================================================

# --------------------------------------------------------------------------
# Flag parsing
# --------------------------------------------------------------------------
SKIP_ORCHESTRATOR=false
for arg in "$@"; do
  case $arg in
    --no-orchestrator) SKIP_ORCHESTRATOR=true ;;
  esac
done

# --------------------------------------------------------------------------
# Project-level constants
# --------------------------------------------------------------------------
PROJECT_NAME="Taskinfa Kanban"
DEFAULT_PORT=3000
MIN_NODE_VERSION=18

# Dev user seeded on every fresh start
DEV_EMAIL="dev@taskinfa.local"
DEV_PASSWORD="DevPass123!"
DEV_NAME="Local Dev"

# Orchestrator tuning — 10s poll for local dev (vs 900000ms in production)
ORCHESTRATOR_POLL_INTERVAL=10000

# Runtime state
APP_PORT=$DEFAULT_PORT
DEV_API_KEY=""
DASHBOARD_PID=""
ORCHESTRATOR_PID=""
COOKIE_JAR=$(mktemp /tmp/taskinfa-dev-cookies.XXXXXX)

# --------------------------------------------------------------------------
# Colors
# --------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# --------------------------------------------------------------------------
# Get absolute project root
# --------------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --------------------------------------------------------------------------
# Cleanup — runs on Ctrl+C or script exit
# --------------------------------------------------------------------------
cleanup() {
  echo ""
  echo -e "${CYAN}Shutting down services...${NC}"

  if [ -n "$DASHBOARD_PID" ] && kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    kill "$DASHBOARD_PID" 2>/dev/null
    echo -e "  ${GREEN}✓ Dashboard stopped${NC}"
  fi

  if [ -n "$ORCHESTRATOR_PID" ] && kill -0 "$ORCHESTRATOR_PID" 2>/dev/null; then
    kill "$ORCHESTRATOR_PID" 2>/dev/null
    echo -e "  ${GREEN}✓ Orchestrator stopped${NC}"
  fi

  rm -f "$COOKIE_JAR" 2>/dev/null

  echo ""
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ============================================================================
# HEADER
# ============================================================================

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    ${PROJECT_NAME} — Local Development Setup    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# PHASE 1: PREREQUISITES
# ============================================================================

echo -e "${CYAN}[1/9] Checking prerequisites...${NC}"

check_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${RED}  ✗ Node.js not installed — https://nodejs.org${NC}"
    exit 1
  fi
  local ver
  ver=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$ver" -lt "$MIN_NODE_VERSION" ]; then
    echo -e "${RED}  ✗ Node.js $ver is too old (need ${MIN_NODE_VERSION}+)${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓ Node.js $(node -v)${NC}"
}

check_npm() {
  if ! command -v npm &>/dev/null; then
    echo -e "${RED}  ✗ npm not installed${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓ npm $(npm -v)${NC}"
}

check_python3() {
  if ! command -v python3 &>/dev/null; then
    echo -e "${RED}  ✗ python3 not found (needed for API seeding)${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓ python3 available${NC}"
}

check_wrangler() {
  # wrangler is a devDependency — always available after npm install via npx
  echo -e "  ${GREEN}✓ wrangler via npx${NC}"
}

check_claude_cli() {
  if ! command -v claude &>/dev/null; then
    echo -e "  ${YELLOW}⚠ Claude CLI not found — orchestrator will be skipped${NC}"
    echo -e "  ${DIM}  Install from: https://claude.ai/download${NC}"
    SKIP_ORCHESTRATOR=true
  else
    echo -e "  ${GREEN}✓ Claude CLI installed${NC}"
  fi
}

check_gh_cli() {
  if ! command -v gh &>/dev/null; then
    echo -e "  ${YELLOW}⚠ GitHub CLI not found (optional for PR workflows)${NC}"
  else
    echo -e "  ${GREEN}✓ GitHub CLI installed${NC}"
  fi
}

check_node
check_npm
check_python3
check_wrangler
check_claude_cli
check_gh_cli
echo ""

# ============================================================================
# PHASE 2: DEPENDENCIES
# ============================================================================

echo -e "${CYAN}[2/9] Installing dependencies...${NC}"

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  cd "$PROJECT_DIR"
  if ! npm install; then
    echo -e "${RED}  ✗ npm install failed${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "  ${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# ============================================================================
# PHASE 3: PORT RESOLUTION
# ============================================================================

echo -e "${CYAN}[3/9] Checking ports...${NC}"

is_port_in_use() {
  lsof -Pi :"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

get_port_process_cwd() {
  local pid
  pid=$(lsof -Pi :"$1" -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -z "$pid" ] && echo "" && return
  if [[ "$OSTYPE" == "darwin"* ]]; then
    lsof -p "$pid" 2>/dev/null | grep cwd | awk '{print $9}'
  else
    readlink -f /proc/"$pid"/cwd 2>/dev/null
  fi
}

is_same_project() {
  local cwd
  cwd=$(get_port_process_cwd "$1")
  [ -z "$cwd" ] && return 1
  [[ "$cwd" == "$PROJECT_DIR"* ]] && return 0 || return 1
}

find_available_port() {
  local port=$1
  for ((i=0; i<20; i++)); do
    ! is_port_in_use "$port" && echo "$port" && return 0
    port=$((port + 1))
  done
  echo "" && return 1
}

if is_port_in_use "$APP_PORT"; then
  if is_same_project "$APP_PORT"; then
    # Server already running from this project — show quick status and exit
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Dev server already running!                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}Dashboard:${NC}  ${GREEN}http://localhost:$APP_PORT${NC}"
    echo ""
    echo -e "${DIM}  To stop: Ctrl+C in the running terminal, or: pkill -f 'next dev'${NC}"
    echo ""
    # Cancel the EXIT trap so cleanup doesn't kill the already-running server
    trap - EXIT
    exit 0
  else
    echo -e "  ${YELLOW}⚠ Port $APP_PORT in use by another project${NC}"
    APP_PORT=$(find_available_port $((DEFAULT_PORT + 1)))
    if [ -z "$APP_PORT" ]; then
      echo -e "${RED}  ✗ Could not find an available port${NC}"
      exit 1
    fi
    echo -e "  ${CYAN}Using port: $APP_PORT${NC}"
  fi
else
  echo -e "  ${GREEN}✓ Port $APP_PORT available${NC}"
fi
echo ""

# ============================================================================
# PHASE 4: DATABASE RESET + MIGRATIONS
# ============================================================================

echo -e "${CYAN}[4/9] Resetting local database...${NC}"

# Wipe local D1 SQLite state for a clean slate on each dev session
D1_STATE_DIR="$PROJECT_DIR/packages/dashboard/.wrangler/state/v3/d1"
if [ -d "$D1_STATE_DIR" ]; then
  rm -rf "$D1_STATE_DIR"
  echo -e "  ${YELLOW}Dropped existing local D1 state${NC}"
fi

# Apply all tracked migrations
echo -e "  Applying migrations..."
cd "$PROJECT_DIR/packages/dashboard"
MIGRATION_OUTPUT=$(npx wrangler d1 migrations apply taskinfa-kanban-db --local 2>&1)
MIGRATION_EXIT=$?

if [ $MIGRATION_EXIT -ne 0 ]; then
  echo -e "${RED}  ✗ Migration failed${NC}"
  echo "$MIGRATION_OUTPUT" | sed 's/^/    /'
  exit 1
fi

# Show only the meaningful migration lines
APPLIED=$(echo "$MIGRATION_OUTPUT" | grep -E "(Applying|Skipped|Applied|migration)" | head -20)
if [ -n "$APPLIED" ]; then
  echo "$APPLIED" | sed 's/^/    /'
fi

echo -e "  ${GREEN}✓ Migrations applied${NC}"
echo ""

# ============================================================================
# PHASE 5: DASHBOARD CONFIG (.dev.vars + .env.local)
# ============================================================================

echo -e "${CYAN}[5/9] Configuring dashboard...${NC}"

# Generate a fresh secret on every run (DB is reset anyway so all sessions are invalid)
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "local-dev-secret-$(date +%s)-change-in-production")

# .dev.vars — read by @opennextjs/cloudflare to expose Cloudflare bindings/secrets
cat > "$PROJECT_DIR/packages/dashboard/.dev.vars" << EOF
# Auto-generated by dev.sh — safe for local development only
# DO NOT commit this file to git

JWT_SECRET=$JWT_SECRET
ENVIRONMENT=development
EOF

# .env.local — read by Next.js process.env (needed for session.ts and other server code)
cat > "$PROJECT_DIR/packages/dashboard/.env.local" << EOF
# Auto-generated by dev.sh — safe for local development only
# DO NOT commit this file to git

JWT_SECRET=$JWT_SECRET
ENVIRONMENT=development
EOF

echo -e "  ${GREEN}✓ .dev.vars and .env.local written${NC}"
echo ""

# ============================================================================
# PHASE 6: START NEXT.JS DASHBOARD
# ============================================================================

echo -e "${CYAN}[6/9] Starting dashboard...${NC}"

cd "$PROJECT_DIR/packages/dashboard"
PORT=$APP_PORT npm run dev > "$PROJECT_DIR/.dev-dashboard.log" 2>&1 &
DASHBOARD_PID=$!

echo -e "  ${BLUE}▶ Next.js on port $APP_PORT${NC} ${DIM}(PID: $DASHBOARD_PID)${NC}"
echo ""

# ============================================================================
# PHASE 7: HEALTH CHECK
# ============================================================================

echo -e "${CYAN}[7/9] Waiting for dashboard...${NC}"
sleep 3

MAX_RETRIES=45
RETRY_COUNT=0
SERVER_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" =~ ^(200|304|307|308)$ ]]; then
    echo -e "  ${GREEN}✓ Dashboard ready${NC} ${DIM}(http://localhost:$APP_PORT)${NC}"
    SERVER_READY=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  # Show progress every 5 seconds
  if (( RETRY_COUNT % 5 == 0 )); then
    echo -e "  ${DIM}  Still waiting... (${RETRY_COUNT}s)${NC}"
  fi
  sleep 1
done

if [ "$SERVER_READY" = false ]; then
  echo -e "${RED}  ✗ Dashboard failed to start after ${MAX_RETRIES}s${NC}"
  echo -e "${YELLOW}    tail -f $PROJECT_DIR/.dev-dashboard.log${NC}"
  exit 1
fi
echo ""

# ============================================================================
# PHASE 8: SEED DATABASE
# ============================================================================

echo -e "${CYAN}[8/9] Seeding database...${NC}"

seed_database() {
  # ── Create dev user via signup ──────────────────────────────────────────
  local signup_response
  signup_response=$(curl -s \
    -c "$COOKIE_JAR" \
    -X POST "http://localhost:$APP_PORT/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"$DEV_NAME\"}" \
    2>/dev/null)

  local user_id
  user_id=$(echo "$signup_response" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))" 2>/dev/null)

  if [ -z "$user_id" ]; then
    echo -e "${RED}  ✗ Failed to create dev user${NC}"
    echo -e "${DIM}    Response: $signup_response${NC}"
    return 1
  fi
  echo -e "  ${GREEN}✓ Dev user created${NC} ${DIM}(id: $user_id)${NC}"

  # ── Create API key using the session cookie from signup ─────────────────
  local key_response
  key_response=$(curl -s \
    -b "$COOKIE_JAR" \
    -X POST "http://localhost:$APP_PORT/api/keys" \
    -H "Content-Type: application/json" \
    -d '{"name":"Local Dev Orchestrator","expiresInDays":365}' \
    2>/dev/null)

  DEV_API_KEY=$(echo "$key_response" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('key',''))" 2>/dev/null)

  if [ -z "$DEV_API_KEY" ]; then
    echo -e "${RED}  ✗ Failed to generate API key${NC}"
    echo -e "${DIM}    Response: $key_response${NC}"
    return 1
  fi
  echo -e "  ${GREEN}✓ API key generated${NC} ${DIM}(Local Dev Orchestrator)${NC}"
  return 0
}

if ! seed_database; then
  echo -e "${YELLOW}  ⚠ Seeding failed — orchestrator will be skipped${NC}"
  echo -e "${DIM}    Check: tail -f $PROJECT_DIR/.dev-dashboard.log${NC}"
  SKIP_ORCHESTRATOR=true
fi
echo ""

# ============================================================================
# PHASE 9: WRITE ORCHESTRATOR .env
# ============================================================================

echo -e "${CYAN}[9/9] Configuring orchestrator...${NC}"

ORCHESTRATOR_ENV="$PROJECT_DIR/.env"

if [ -n "$DEV_API_KEY" ]; then
  cat > "$ORCHESTRATOR_ENV" << EOF
# Auto-generated by dev.sh — local development environment
# Generated: $(date)
# DO NOT commit this file to git

# ── Dashboard connection ──────────────────────────────────────────────────
KANBAN_API_URL=http://localhost:$APP_PORT
KANBAN_API_KEY=$DEV_API_KEY

# ── Polling ───────────────────────────────────────────────────────────────
# 10 seconds for local dev. Production default: 900000ms (15 minutes)
POLL_INTERVAL=$ORCHESTRATOR_POLL_INTERVAL

# ── Concurrency ───────────────────────────────────────────────────────────
MAX_CONCURRENT=3
MAX_RETRIES=3

# ── Runtime ───────────────────────────────────────────────────────────────
ENVIRONMENT=development
EOF
  echo -e "  ${GREEN}✓ Wrote .env${NC} ${DIM}(KANBAN_API_URL=http://localhost:$APP_PORT)${NC}"
else
  echo -e "  ${YELLOW}⚠ No API key — skipping .env generation${NC}"
fi
echo ""

# ============================================================================
# START ORCHESTRATOR (optional)
# ============================================================================

if [ "$SKIP_ORCHESTRATOR" = false ] && [ -n "$DEV_API_KEY" ]; then
  echo -e "${CYAN}Starting orchestrator...${NC}"
  cd "$PROJECT_DIR"
  npx tsx --env-file="$ORCHESTRATOR_ENV" scripts/orchestrator.ts \
    > "$PROJECT_DIR/.dev-orchestrator.log" 2>&1 &
  ORCHESTRATOR_PID=$!

  # Give it a moment to either start or crash
  sleep 2

  if kill -0 "$ORCHESTRATOR_PID" 2>/dev/null; then
    echo -e "  ${GREEN}▶ Orchestrator running${NC} ${DIM}(PID: $ORCHESTRATOR_PID, polls every 10s)${NC}"
  else
    echo -e "  ${YELLOW}⚠ Orchestrator exited immediately — check logs${NC}"
    echo -e "  ${DIM}    tail -f $PROJECT_DIR/.dev-orchestrator.log${NC}"
    ORCHESTRATOR_PID=""
  fi
  echo ""
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           Taskinfa Dev Environment Ready ✓                      ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Services ────────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Services${NC}"
echo -e "  ${DIM}──────────────────────────────────────────────────────────────${NC}"
echo -e "  Dashboard      ${GREEN}http://localhost:$APP_PORT${NC}"
if [ -n "$ORCHESTRATOR_PID" ]; then
  echo -e "  Orchestrator   ${GREEN}Running${NC} — polls every 10s"
elif [ "$SKIP_ORCHESTRATOR" = true ] && ! command -v claude &>/dev/null; then
  echo -e "  Orchestrator   ${YELLOW}Not running${NC} — Claude CLI not installed"
elif [ "$SKIP_ORCHESTRATOR" = true ]; then
  echo -e "  Orchestrator   ${YELLOW}Not running${NC} — started with --no-orchestrator"
else
  echo -e "  Orchestrator   ${YELLOW}Failed to start${NC} — check .dev-orchestrator.log"
fi
echo ""

# ── Dev user ────────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Dev User (seeded fresh every start)${NC}"
echo -e "  ${DIM}──────────────────────────────────────────────────────────────${NC}"
echo -e "  Email          ${CYAN}$DEV_EMAIL${NC}"
echo -e "  Password       ${CYAN}$DEV_PASSWORD${NC}"
echo ""

# ── Orchestrator config ──────────────────────────────────────────────────────
if [ -n "$DEV_API_KEY" ]; then
  echo -e "  ${BOLD}Orchestrator Config${NC}"
  echo -e "  ${DIM}──────────────────────────────────────────────────────────────${NC}"
  echo -e "  Config file    ${DIM}$ORCHESTRATOR_ENV${NC}"
  echo -e "  API key        ${CYAN}$DEV_API_KEY${NC}"
  echo -e "  Poll interval  ${CYAN}10 seconds${NC} ${DIM}(POLL_INTERVAL=10000)${NC}"
  echo -e "  Dashboard URL  ${CYAN}http://localhost:$APP_PORT${NC}"
  echo ""
fi

# ── Logs ────────────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Logs${NC}"
echo -e "  ${DIM}──────────────────────────────────────────────────────────────${NC}"
echo -e "  Dashboard      ${DIM}tail -f $PROJECT_DIR/.dev-dashboard.log${NC}"
if [ -n "$ORCHESTRATOR_PID" ]; then
  echo -e "  Orchestrator   ${DIM}tail -f $PROJECT_DIR/.dev-orchestrator.log${NC}"
fi
echo ""

# ── Commands ────────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Commands${NC}"
echo -e "  ${DIM}──────────────────────────────────────────────────────────────${NC}"
echo -e "  Open board         ${CYAN}open http://localhost:$APP_PORT${NC}"
echo -e "  Start orchestrator ${CYAN}npm run orchestrator${NC}  ${DIM}(from project root)${NC}"
echo -e "  Stop orchestrator  ${CYAN}kill $ORCHESTRATOR_PID${NC}  ${DIM}(or Ctrl+C here)${NC}"
echo -e "  DB migrations      ${CYAN}cd packages/dashboard && npm run db:migrate${NC}"
echo -e "  Orch. logs         ${CYAN}tail -f .dev-orchestrator.log${NC}"
echo -e "  Dashboard logs     ${CYAN}tail -f .dev-dashboard.log${NC}"
echo -e "  Stop everything    ${YELLOW}Ctrl+C${NC}"
echo ""
echo -e "${DIM}  Fresh start anytime: git pull origin main && ./dev.sh${NC}"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop all services${NC}"
echo ""

# ============================================================================
# WAIT — keep script alive so Ctrl+C hits our cleanup trap
# ============================================================================

# Disable the EXIT trap so cleanup only fires on SIGINT / SIGTERM
trap - EXIT
trap cleanup SIGINT SIGTERM

if [ -n "$ORCHESTRATOR_PID" ]; then
  wait "$DASHBOARD_PID" "$ORCHESTRATOR_PID"
else
  wait "$DASHBOARD_PID"
fi
