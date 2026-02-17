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
#   Phase 5  Dashboard config + create projects directory
#   Phase 6  Start Next.js dashboard
#   Phase 7  Health check (wait for server ready)
#   Phase 8  Seed DB (dev user + API key + test projects via live API)
#   Phase 9  Write orchestrator .env (API key, PROJECTS_DIR, GH_TOKEN, etc.)
#   Phase 10 Start orchestrator (optional, polls every 10s locally)
#   Phase 11 Print full dev summary
#
# Usage:
#   ./dev.sh                   Start dashboard + orchestrator (default)
#   ./dev.sh --no-orchestrator Start dashboard only
#
# Config:
#   dev-sh-config.json         All non-secret settings (port, projects dir, etc.)
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
# Project root (absolute path to repo)
# --------------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="Taskinfa Kanban"
MIN_NODE_VERSION=18

# --------------------------------------------------------------------------
# Read dev-sh-config.json
# --------------------------------------------------------------------------
CONFIG_FILE="$PROJECT_DIR/dev-sh-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}✗ dev-sh-config.json not found at $CONFIG_FILE${NC}"
  exit 1
fi

# Helper: read a value from config via python3; $1 is a python expression on dict d
cfg() {
  python3 -c "
import json, os, sys
d = json.load(open('$CONFIG_FILE'))
try:
    v = $1
    print(v if v is not None else '')
except Exception:
    print('')
" 2>/dev/null
}

DEFAULT_PORT=$(cfg "d.get('port', 3000)")
DEV_EMAIL=$(cfg "d.get('devUser', {}).get('email', 'dev@taskinfa.local')")
DEV_PASSWORD=$(cfg "d.get('devUser', {}).get('password', 'DevPass123!')")
DEV_NAME=$(cfg "d.get('devUser', {}).get('name', 'Local Dev')")
ORCHESTRATOR_POLL_INTERVAL=$(cfg "d.get('orchestrator', {}).get('pollInterval', 10000)")
MAX_CONCURRENT=$(cfg "d.get('orchestrator', {}).get('maxConcurrent', 3)")
MAX_RETRIES=$(cfg "d.get('orchestrator', {}).get('maxRetries', 3)")

# Expand ~ to $HOME for the projects directory path
PROJECTS_DIR_RAW=$(cfg "d.get('orchestrator', {}).get('projectsDir', '~/workspace/taskinfa-dev-projects')")
PROJECTS_DIR="${PROJECTS_DIR_RAW/\~/$HOME}"

# --------------------------------------------------------------------------
# Runtime state
# --------------------------------------------------------------------------
APP_PORT=$DEFAULT_PORT
DEV_API_KEY=""
DASHBOARD_PID=""
ORCHESTRATOR_PID=""
SEEDED_PROJECTS=()
COOKIE_JAR=$(mktemp /tmp/taskinfa-dev-cookies.XXXXXX)

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
    echo -e "${RED}  ✗ python3 not found (needed for config + API seeding)${NC}"
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
    echo -e "  ${YELLOW}⚠ GitHub CLI not found (optional — needed to clone private repos)${NC}"
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

# Build shared package if dist/ is missing or stale
# (dist/ is gitignored so it's absent on fresh clones)
SHARED_DIST="$PROJECT_DIR/packages/shared/dist/index.js"
SHARED_SRC="$PROJECT_DIR/packages/shared/src/types/index.ts"
if [ ! -f "$SHARED_DIST" ] || [ "$SHARED_SRC" -nt "$SHARED_DIST" ]; then
  echo -e "  ${CYAN}Building @taskinfa/shared...${NC}"
  cd "$PROJECT_DIR/packages/shared"
  if ! npm run build > /dev/null 2>&1; then
    echo -e "${RED}  ✗ Failed to build @taskinfa/shared${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓ @taskinfa/shared built${NC}"
else
  echo -e "  ${GREEN}✓ @taskinfa/shared already built${NC}"
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
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Dev server already running!                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}Dashboard:${NC}  ${GREEN}http://localhost:$APP_PORT${NC}"
    echo ""
    echo -e "${DIM}  To stop: Ctrl+C in the running terminal, or: pkill -f 'next dev'${NC}"
    echo ""
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

D1_STATE_DIR="$PROJECT_DIR/packages/dashboard/.wrangler/state/v3/d1"
if [ -d "$D1_STATE_DIR" ]; then
  rm -rf "$D1_STATE_DIR"
  echo -e "  ${YELLOW}Dropped existing local D1 state${NC}"
fi

echo -e "  Applying migrations..."
cd "$PROJECT_DIR/packages/dashboard"
MIGRATION_OUTPUT=$(npx wrangler d1 migrations apply taskinfa-kanban-db --local 2>&1)
MIGRATION_EXIT=$?

if [ $MIGRATION_EXIT -ne 0 ]; then
  echo -e "${RED}  ✗ Migration failed${NC}"
  echo "$MIGRATION_OUTPUT" | sed 's/^/    /'
  exit 1
fi

APPLIED=$(echo "$MIGRATION_OUTPUT" | grep -E "(Applying|Skipped|Applied|migration)" | head -20)
if [ -n "$APPLIED" ]; then
  echo "$APPLIED" | sed 's/^/    /'
fi

echo -e "  ${GREEN}✓ Migrations applied${NC}"
echo ""

# ============================================================================
# PHASE 5: DASHBOARD CONFIG + PROJECTS DIRECTORY
# ============================================================================

echo -e "${CYAN}[5/9] Configuring environment...${NC}"

# Fresh secret every run (DB is reset so all sessions are invalid anyway)
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "local-dev-secret-$(date +%s)-change-in-production")

# .dev.vars — Cloudflare bindings for @opennextjs/cloudflare
cat > "$PROJECT_DIR/packages/dashboard/.dev.vars" << EOF
# Auto-generated by dev.sh — safe for local development only
# DO NOT commit this file to git

JWT_SECRET=$JWT_SECRET
ENVIRONMENT=development
EOF

# .env.local — Next.js process.env (needed by session.ts, etc.)
cat > "$PROJECT_DIR/packages/dashboard/.env.local" << EOF
# Auto-generated by dev.sh — safe for local development only
# DO NOT commit this file to git

JWT_SECRET=$JWT_SECRET
ENVIRONMENT=development
EOF

echo -e "  ${GREEN}✓ .dev.vars and .env.local written${NC}"

# Create the local projects directory where the orchestrator will clone repos
mkdir -p "$PROJECTS_DIR"
echo -e "  ${GREEN}✓ Projects directory ready${NC} ${DIM}($PROJECTS_DIR)${NC}"
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

# ── 8a: Create dev user + API key ───────────────────────────────────────────
seed_user_and_key() {
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

# ── 8b: Create test projects (task_lists) from dev-sh-config.json ──────────
seed_test_projects() {
  local project_count
  project_count=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
print(len(d.get('testProjects', [])))
" 2>/dev/null)

  if [ -z "$project_count" ] || [ "$project_count" -eq 0 ]; then
    echo -e "  ${DIM}No test projects configured in dev-sh-config.json${NC}"
    return 0
  fi

  for i in $(seq 0 $((project_count - 1))); do
    local name repo_url description
    name=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
print(d['testProjects'][$i]['name'])
" 2>/dev/null)
    repo_url=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
print(d['testProjects'][$i].get('repositoryUrl', ''))
" 2>/dev/null)
    description=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
print(d['testProjects'][$i].get('description', ''))
" 2>/dev/null)

    local payload
    payload=$(python3 -c "
import json
print(json.dumps({'name': '$name', 'description': '$description', 'repository_url': '$repo_url'}))
" 2>/dev/null)

    local create_response project_id
    create_response=$(curl -s \
      -b "$COOKIE_JAR" \
      -X POST "http://localhost:$APP_PORT/api/task-lists" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      2>/dev/null)

    project_id=$(echo "$create_response" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('task_list',{}).get('id',''))" 2>/dev/null)

    if [ -n "$project_id" ]; then
      echo -e "  ${GREEN}✓ Project seeded${NC}: $name ${DIM}(id: $project_id)${NC}"
      SEEDED_PROJECTS+=("$name|$repo_url|$project_id")
    else
      echo -e "  ${YELLOW}⚠ Failed to seed project${NC}: $name"
      echo -e "  ${DIM}    Response: $create_response${NC}"
    fi
  done
}

if ! seed_user_and_key; then
  echo -e "${YELLOW}  ⚠ Seeding failed — orchestrator will be skipped${NC}"
  echo -e "${DIM}    Check: tail -f $PROJECT_DIR/.dev-dashboard.log${NC}"
  SKIP_ORCHESTRATOR=true
else
  seed_test_projects
fi

rm -f "$COOKIE_JAR" 2>/dev/null
COOKIE_JAR=""
echo ""

# ============================================================================
# PHASE 9: WRITE ORCHESTRATOR .env
# ============================================================================

echo -e "${CYAN}[9/9] Configuring orchestrator...${NC}"

ORCHESTRATOR_ENV="$PROJECT_DIR/.env"

# Grab GH_TOKEN from gh CLI if authenticated (needed to clone private repos)
GH_TOKEN=$(gh auth token 2>/dev/null || echo "")

if [ -n "$DEV_API_KEY" ]; then
  cat > "$ORCHESTRATOR_ENV" << EOF
# Auto-generated by dev.sh — local development environment
# Generated: $(date)
# DO NOT commit this file to git

# ── Dashboard connection ──────────────────────────────────────────────────
KANBAN_API_URL=http://localhost:$APP_PORT
KANBAN_API_KEY=$DEV_API_KEY

# ── Projects workspace ────────────────────────────────────────────────────
# Repos are cloned to: \$PROJECTS_DIR/<project-id>/
WORKSPACE_ROOT=$PROJECTS_DIR
PROJECTS_DIR=$PROJECTS_DIR

# ── Polling ───────────────────────────────────────────────────────────────
# ${ORCHESTRATOR_POLL_INTERVAL}ms for local dev. Production default: 900000ms (15 minutes)
POLL_INTERVAL=$ORCHESTRATOR_POLL_INTERVAL

# ── Concurrency ───────────────────────────────────────────────────────────
MAX_CONCURRENT=$MAX_CONCURRENT
MAX_RETRIES=$MAX_RETRIES

# ── GitHub token (for cloning private repos + creating PRs) ───────────────
GH_TOKEN=$GH_TOKEN

# ── Runtime ───────────────────────────────────────────────────────────────
ENVIRONMENT=development
EOF
  echo -e "  ${GREEN}✓ Wrote .env${NC} ${DIM}(KANBAN_API_URL=http://localhost:$APP_PORT)${NC}"
  echo -e "  ${GREEN}✓ PROJECTS_DIR=${NC}${DIM}$PROJECTS_DIR${NC}"
  if [ -n "$GH_TOKEN" ]; then
    echo -e "  ${GREEN}✓ GH_TOKEN set${NC} ${DIM}(from gh CLI auth)${NC}"
  else
    echo -e "  ${YELLOW}⚠ GH_TOKEN not set${NC} ${DIM}(run: gh auth login)${NC}"
  fi
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

  sleep 2

  if kill -0 "$ORCHESTRATOR_PID" 2>/dev/null; then
    echo -e "  ${GREEN}▶ Orchestrator running${NC} ${DIM}(PID: $ORCHESTRATOR_PID, polls every ${ORCHESTRATOR_POLL_INTERVAL}ms)${NC}"
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
  echo -e "  Orchestrator   ${GREEN}Running${NC} — polls every ${ORCHESTRATOR_POLL_INTERVAL}ms"
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
  echo -e "  Poll interval  ${CYAN}${ORCHESTRATOR_POLL_INTERVAL}ms${NC}"
  echo -e "  Projects dir   ${CYAN}$PROJECTS_DIR${NC}"
  if [ -n "$GH_TOKEN" ]; then
    echo -e "  GH_TOKEN       ${GREEN}set${NC} ${DIM}(repos can be cloned)${NC}"
  else
    echo -e "  GH_TOKEN       ${YELLOW}not set${NC} ${DIM}(run gh auth login to enable repo cloning)${NC}"
  fi
  echo ""
fi

# ── Test projects ────────────────────────────────────────────────────────────
if [ ${#SEEDED_PROJECTS[@]} -gt 0 ]; then
  echo -e "  ${BOLD}Test Projects${NC} ${DIM}(seeded in kanban — orchestrator will clone on first poll)${NC}"
  echo -e "  ${DIM}──────────────────────────────────────────────────────────────${NC}"
  for entry in "${SEEDED_PROJECTS[@]}"; do
    IFS='|' read -r p_name p_repo p_id <<< "$entry"
    echo -e "  ${CYAN}$p_name${NC}"
    echo -e "    Repo   ${DIM}$p_repo${NC}"
    echo -e "    Clones to  ${DIM}$PROJECTS_DIR/$p_id${NC}"
  done
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
if [ -n "$ORCHESTRATOR_PID" ]; then
  echo -e "  Stop orchestrator  ${CYAN}kill $ORCHESTRATOR_PID${NC}  ${DIM}(or Ctrl+C here)${NC}"
fi
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

trap - EXIT
trap cleanup SIGINT SIGTERM

if [ -n "$ORCHESTRATOR_PID" ]; then
  wait "$DASHBOARD_PID" "$ORCHESTRATOR_PID"
else
  wait "$DASHBOARD_PID"
fi
