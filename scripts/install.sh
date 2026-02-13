#!/bin/bash
# Taskinfa Orchestrator Installer
# One-liner: curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/install.sh | bash

set -e

# Re-run interactively if piped from curl
if [ ! -t 0 ] && [[ "$0" != *taskinfa-install* ]]; then
    TEMP_SCRIPT=$(mktemp -t taskinfa-install.XXXXXX)
    curl -fsSL https://raw.githubusercontent.com/secanltd/taskinfa-kanban/main/scripts/install.sh -o "$TEMP_SCRIPT"
    chmod +x "$TEMP_SCRIPT"
    exec bash "$TEMP_SCRIPT" </dev/tty
fi

# ── Colors ──────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
info() { echo -e "${BLUE}[info]${NC} $1"; }

has() { command -v "$1" >/dev/null 2>&1; }

# ── Banner ──────────────────────────────────────────────────────────

echo
echo -e "${BOLD}Taskinfa Orchestrator Installer${NC}"
echo "────────────────────────────────────────"
echo

# ── Step 1: Prerequisites ──────────────────────────────────────────

echo -e "${BOLD}Step 1: Checking prerequisites${NC}"
echo

MISSING=0

# Node.js 18+
if has node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
        ok "Node.js $(node -v)"
    else
        err "Node.js $(node -v) — version 18+ required"
        MISSING=1
    fi
else
    err "Node.js not found — install from https://nodejs.org"
    MISSING=1
fi

# Claude CLI
if has claude; then
    ok "Claude CLI installed"
else
    warn "Claude CLI not found — install from https://claude.ai/download"
    echo "  The orchestrator spawns Claude Code sessions, so it must be installed."
    MISSING=1
fi

# gh CLI or GH_TOKEN
if has gh; then
    ok "GitHub CLI installed"
elif [ -n "$GH_TOKEN" ]; then
    ok "GH_TOKEN set"
else
    warn "Neither gh CLI nor GH_TOKEN found"
    echo "  Required for agents to create PRs on private repos."
fi

if [ "$MISSING" -eq 1 ]; then
    echo
    err "Missing prerequisites. Install them and re-run."
    exit 1
fi

echo

# ── Step 2: Paths ──────────────────────────────────────────────────

echo -e "${BOLD}Step 2: Choose install paths${NC}"
echo

DEFAULT_HOME="$PWD/.taskinfa-kanban"
DEFAULT_PROJECTS="$PWD/taskinfa-projects"

read -p "Install directory [$DEFAULT_HOME]: " TASKINFA_HOME
TASKINFA_HOME="${TASKINFA_HOME:-$DEFAULT_HOME}"

read -p "Projects directory [$DEFAULT_PROJECTS]: " PROJECTS_DIR
PROJECTS_DIR="${PROJECTS_DIR:-$DEFAULT_PROJECTS}"

echo
ok "Install directory: $TASKINFA_HOME"
ok "Projects directory: $PROJECTS_DIR"
echo

# ── Step 3: Credentials ───────────────────────────────────────────

echo -e "${BOLD}Step 3: Credentials${NC}"
echo

# API Key
while true; do
    read -p "Taskinfa API key (tk_...): " KANBAN_API_KEY
    if [ -z "$KANBAN_API_KEY" ]; then
        err "API key is required"
    else
        break
    fi
done

# Dashboard URL
DEFAULT_URL="https://kanban.taskinfa.com"
read -p "Dashboard URL [$DEFAULT_URL]: " KANBAN_API_URL
KANBAN_API_URL="${KANBAN_API_URL:-$DEFAULT_URL}"

# GitHub token
GH_TOKEN_VAL=""
if has gh; then
    GH_TOKEN_VAL=$(gh auth token 2>/dev/null || true)
    if [ -n "$GH_TOKEN_VAL" ]; then
        ok "GitHub token auto-detected from gh CLI"
    fi
fi
if [ -z "$GH_TOKEN_VAL" ]; then
    read -p "GitHub token (for private repos, leave empty to skip): " GH_TOKEN_VAL
fi

echo

# ── Step 4: Settings ──────────────────────────────────────────────

echo -e "${BOLD}Step 4: Settings${NC}"
echo

read -p "Max concurrent sessions [3]: " MAX_CONCURRENT
MAX_CONCURRENT="${MAX_CONCURRENT:-3}"

read -p "Poll interval in minutes [15]: " POLL_MINUTES
POLL_MINUTES="${POLL_MINUTES:-15}"
POLL_INTERVAL=$(( POLL_MINUTES * 60 * 1000 ))

echo

# ── Step 5: Telegram (optional) ──────────────────────────────────

echo -e "${BOLD}Step 5: Telegram notifications (optional)${NC}"
echo

read -p "Telegram bot token (leave empty to skip): " TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=""
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    read -p "Telegram chat ID: " TELEGRAM_CHAT_ID
fi

echo

# ── Step 6: Create directory structure ─────────────────────────────

echo -e "${BOLD}Step 6: Installing${NC}"
echo

mkdir -p "$TASKINFA_HOME/bin"
mkdir -p "$TASKINFA_HOME/logs"
mkdir -p "$TASKINFA_HOME/state"
mkdir -p "$PROJECTS_DIR"

ok "Created directory structure"

# ── Download orchestrator ──────────────────────────────────────────

info "Downloading orchestrator..."
DOWNLOAD_URL="https://github.com/secanltd/taskinfa-kanban/releases/latest/download/orchestrator.js"
if curl -fsSL "$DOWNLOAD_URL" -o "$TASKINFA_HOME/orchestrator.js" 2>/dev/null; then
    ok "Downloaded orchestrator.js"
else
    warn "Could not download from GitHub Releases."
    echo "  You can manually place orchestrator.js in $TASKINFA_HOME/"
    echo "  Build it with: npm run build:orchestrator (in the taskinfa-kanban repo)"
fi

# ── Write config.env ───────────────────────────────────────────────

cat > "$TASKINFA_HOME/config.env" << EOF
# Taskinfa Orchestrator Configuration
# Generated by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

TASKINFA_HOME=$TASKINFA_HOME
PROJECTS_DIR=$PROJECTS_DIR
KANBAN_API_URL=$KANBAN_API_URL
KANBAN_API_KEY=$KANBAN_API_KEY
GH_TOKEN=$GH_TOKEN_VAL
POLL_INTERVAL=$POLL_INTERVAL
MAX_CONCURRENT=$MAX_CONCURRENT
MAX_RETRIES=3
EOF

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    cat >> "$TASKINFA_HOME/config.env" << EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
fi

chmod 600 "$TASKINFA_HOME/config.env"
ok "Wrote config.env"

# ── Create CLI script ─────────────────────────────────────────────

cat > "$TASKINFA_HOME/bin/taskinfa" << 'EOFCLI'
#!/bin/bash
# Taskinfa CLI — manage the orchestrator daemon

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASKINFA_HOME="$(dirname "$SCRIPT_DIR")"
CONFIG="$TASKINFA_HOME/config.env"
PID_FILE="$TASKINFA_HOME/state/orchestrator.pid"
LOG_FILE="$TASKINFA_HOME/logs/orchestrator.log"
ORCH="$TASKINFA_HOME/orchestrator.js"

if [ ! -f "$CONFIG" ]; then
    echo "Error: config.env not found at $CONFIG"
    exit 1
fi

# Source config for API calls
load_config() {
    set -a
    source "$CONFIG"
    set +a
}

is_running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

cmd_start() {
    if is_running; then
        echo "Orchestrator already running (PID $(cat "$PID_FILE"))"
        return 0
    fi
    if [ ! -f "$ORCH" ]; then
        echo "Error: orchestrator.js not found at $ORCH"
        echo "Run: taskinfa update"
        exit 1
    fi
    load_config
    export TASKINFA_CONFIG="$CONFIG"
    nohup node "$ORCH" > /dev/null 2>&1 &
    echo $! > "$PID_FILE"
    echo "Orchestrator started (PID $!)"
    echo "Logs: $LOG_FILE"
}

cmd_stop() {
    if ! is_running; then
        echo "Orchestrator is not running"
        rm -f "$PID_FILE"
        return 0
    fi
    local pid
    pid=$(cat "$PID_FILE")
    kill "$pid"
    rm -f "$PID_FILE"
    echo "Orchestrator stopped (PID $pid)"
}

cmd_restart() {
    cmd_stop
    sleep 1
    cmd_start
}

cmd_status() {
    if is_running; then
        echo "Orchestrator is running (PID $(cat "$PID_FILE"))"
    else
        echo "Orchestrator is not running"
        rm -f "$PID_FILE" 2>/dev/null
    fi
    echo
    echo "Last 5 log lines:"
    tail -5 "$LOG_FILE" 2>/dev/null || echo "  (no logs yet)"
}

cmd_logs() {
    tail -f "$LOG_FILE"
}

get_installed_version() {
    if [ -f "$ORCH" ]; then
        node -e "
            const src = require('fs').readFileSync('$ORCH', 'utf8');
            const m = src.match(/=\"(\d+\.\d+\.\d+)\"/);
            console.log(m ? m[1] : 'unknown');
        " 2>/dev/null || echo "unknown"
    else
        echo "not installed"
    fi
}

get_latest_version() {
    local url="https://api.github.com/repos/secanltd/taskinfa-kanban/releases/latest"
    local response
    response=$(curl -fsSL -H "Accept: application/vnd.github.v3+json" "$url" 2>/dev/null) || return 1
    echo "$response" | node -e "
        const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const tag = data.tag_name || '';
        console.log(tag.replace(/^v/, ''));
    " 2>/dev/null || return 1
}

cmd_doctor() {
    echo "Taskinfa Doctor"
    echo "───────────────"
    echo

    # Version info
    local installed_ver
    installed_ver=$(get_installed_version)
    echo "[ok] Installed version: v${installed_ver}"

    local latest_ver
    latest_ver=$(get_latest_version 2>/dev/null)
    if [ -n "$latest_ver" ] && [ "$latest_ver" != "" ]; then
        echo "[ok] Latest version:    v${latest_ver}"
        if [ "$installed_ver" != "unknown" ] && [ "$installed_ver" != "not installed" ] && [ "$installed_ver" != "$latest_ver" ]; then
            echo "[!!] Update available! Run: taskinfa update"
        fi
    else
        echo "[--] Could not check latest version"
    fi
    echo

    # Node.js
    if command -v node >/dev/null 2>&1; then
        local nv
        nv=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$nv" -ge 18 ]; then
            echo "[ok] Node.js $(node -v)"
        else
            echo "[!!] Node.js $(node -v) — need 18+"
        fi
    else
        echo "[!!] Node.js not found"
    fi

    # Claude CLI
    if command -v claude >/dev/null 2>&1; then
        echo "[ok] Claude CLI installed"
    else
        echo "[!!] Claude CLI not found"
    fi

    # gh CLI
    if command -v gh >/dev/null 2>&1; then
        if gh auth status >/dev/null 2>&1; then
            echo "[ok] GitHub CLI authenticated"
        else
            echo "[!!] GitHub CLI installed but not authenticated"
        fi
    else
        echo "[--] GitHub CLI not installed (optional if GH_TOKEN is set)"
    fi

    # Config
    if [ -f "$CONFIG" ]; then
        echo "[ok] config.env exists"
    else
        echo "[!!] config.env missing"
    fi

    # Orchestrator binary
    if [ -f "$ORCH" ]; then
        echo "[ok] orchestrator.js present"
    else
        echo "[!!] orchestrator.js missing — run: taskinfa update"
    fi

    # Projects dir
    load_config 2>/dev/null
    if [ -d "$PROJECTS_DIR" ]; then
        local count
        count=$(ls -1 "$PROJECTS_DIR" 2>/dev/null | wc -l | tr -d ' ')
        echo "[ok] Projects directory exists ($count projects)"
    else
        echo "[!!] Projects directory missing: $PROJECTS_DIR"
    fi

    # API reachable
    if [ -n "$KANBAN_API_URL" ] && [ -n "$KANBAN_API_KEY" ]; then
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer $KANBAN_API_KEY" \
            "$KANBAN_API_URL/api/tasks?limit=1" 2>/dev/null || echo "000")
        if [ "$status" = "200" ]; then
            echo "[ok] API reachable ($KANBAN_API_URL)"
        else
            echo "[!!] API returned HTTP $status ($KANBAN_API_URL)"
        fi
    else
        echo "[!!] API URL or key not configured"
    fi

    # Running?
    echo
    if is_running; then
        echo "Status: running (PID $(cat "$PID_FILE"))"
    else
        echo "Status: stopped"
    fi
}

cmd_update() {
    local base_url="https://github.com/secanltd/taskinfa-kanban/releases/latest/download"
    local cli_path="$TASKINFA_HOME/bin/taskinfa"

    # Update CLI first so new features take effect on next run
    echo "Updating CLI..."
    local cli_url="$base_url/taskinfa-cli.sh"
    if curl -fsSL "$cli_url" -o "$cli_path.tmp"; then
        if [ ! -s "$cli_path.tmp" ]; then
            rm -f "$cli_path.tmp"
            echo "Warning: downloaded CLI is empty, skipping CLI update"
        else
            chmod +x "$cli_path.tmp"
            mv "$cli_path.tmp" "$cli_path"
            echo "Updated CLI"
        fi
    else
        rm -f "$cli_path.tmp"
        echo "Warning: could not download CLI update, skipping"
    fi

    # Update orchestrator
    local old_ver
    old_ver=$(get_installed_version)
    echo "Current version: v${old_ver}"
    echo "Downloading latest orchestrator..."
    local orch_url="$base_url/orchestrator.js"
    if curl -fsSL "$orch_url" -o "$ORCH.tmp"; then
        if [ ! -s "$ORCH.tmp" ]; then
            rm -f "$ORCH.tmp"
            echo "Error: downloaded orchestrator is empty"
            exit 1
        fi
        mv "$ORCH.tmp" "$ORCH"
        local new_ver
        new_ver=$(get_installed_version)
        echo "Updated to: v${new_ver}"
        echo "Restart with: taskinfa restart"
    else
        rm -f "$ORCH.tmp"
        echo "Error: orchestrator download failed"
        exit 1
    fi

    echo
    sync_skills
}

sync_skills() {
    local repo="secanltd/taskinfa-kanban"
    local skills_dir="$HOME/.claude/skills"
    local api_base="https://api.github.com/repos/$repo"

    # Build auth header if GH_TOKEN or gh CLI is available
    local auth_header=""
    if [ -n "${GH_TOKEN:-}" ]; then
        auth_header="Authorization: token $GH_TOKEN"
    elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        local token
        token=$(gh auth token 2>/dev/null || true)
        if [ -n "$token" ]; then
            auth_header="Authorization: token $token"
        fi
    fi

    local curl_auth=()
    if [ -n "$auth_header" ]; then
        curl_auth=(-H "$auth_header")
    fi

    echo "Syncing skills from $repo..."

    # List skill directories under .claude/skills/ in the repo
    local tree_response
    tree_response=$(curl -fsSL "${curl_auth[@]}" \
        "$api_base/contents/.claude/skills" 2>/dev/null) || {
        echo "  Could not fetch skills list from GitHub (may need authentication)"
        return 0
    }

    # Parse skill directory names using node
    local skill_names
    skill_names=$(echo "$tree_response" | node -e "
        const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        if (!Array.isArray(data)) process.exit(0);
        for (const item of data) {
            if (item.type === 'dir') console.log(item.name);
        }
    " 2>/dev/null) || {
        echo "  Could not parse skills list"
        return 0
    }

    if [ -z "$skill_names" ]; then
        echo "  No skills found in repo"
        return 0
    fi

    local synced_new=()
    local synced_updated=()
    local up_to_date=0

    while IFS= read -r skill_name; do
        [ -z "$skill_name" ] && continue

        # Fetch SKILL.md from the repo
        local remote_content
        remote_content=$(curl -fsSL "${curl_auth[@]}" \
            "$api_base/contents/.claude/skills/$skill_name/SKILL.md" 2>/dev/null) || continue

        # Extract the base64-encoded content and decode it
        local decoded
        decoded=$(echo "$remote_content" | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            if (data.content) {
                process.stdout.write(Buffer.from(data.content, 'base64').toString('utf8'));
            }
        " 2>/dev/null) || continue

        if [ -z "$decoded" ]; then
            continue
        fi

        local local_skill_dir="$skills_dir/$skill_name"
        local local_skill_file="$local_skill_dir/SKILL.md"

        if [ -f "$local_skill_file" ]; then
            # Compare with existing
            local existing
            existing=$(cat "$local_skill_file")
            if [ "$existing" = "$decoded" ]; then
                up_to_date=$((up_to_date + 1))
                continue
            fi
            # Content differs — update
            echo "$decoded" > "$local_skill_file"
            synced_updated+=("$skill_name")
        else
            # New skill
            mkdir -p "$local_skill_dir"
            echo "$decoded" > "$local_skill_file"
            synced_new+=("$skill_name")
        fi
    done <<< "$skill_names"

    # Print summary
    if [ ${#synced_new[@]} -gt 0 ]; then
        echo "  Synced ${#synced_new[@]} new skill(s): $(IFS=', '; echo "${synced_new[*]}")"
    fi
    if [ ${#synced_updated[@]} -gt 0 ]; then
        echo "  Updated ${#synced_updated[@]} skill(s): $(IFS=', '; echo "${synced_updated[*]}")"
    fi
    if [ ${#synced_new[@]} -eq 0 ] && [ ${#synced_updated[@]} -eq 0 ]; then
        echo "  All skills up to date"
    fi
}

cmd_auth() {
    load_config
    echo "Current settings:"
    echo "  API URL: $KANBAN_API_URL"
    echo "  API Key: ${KANBAN_API_KEY:0:20}..."
    [ -n "$GH_TOKEN" ] && echo "  GH Token: ${GH_TOKEN:0:10}..."
    echo
    echo "What would you like to update?"
    echo "  1) API key"
    echo "  2) Dashboard URL"
    echo "  3) GitHub token"
    echo "  4) Cancel"
    read -p "Choice [4]: " choice
    choice="${choice:-4}"
    case "$choice" in
        1)
            read -p "New API key: " new_key
            sed -i "s|^KANBAN_API_KEY=.*|KANBAN_API_KEY=$new_key|" "$CONFIG"
            echo "Updated API key"
            ;;
        2)
            read -p "New dashboard URL: " new_url
            sed -i "s|^KANBAN_API_URL=.*|KANBAN_API_URL=$new_url|" "$CONFIG"
            echo "Updated dashboard URL"
            ;;
        3)
            read -p "New GitHub token: " new_token
            if grep -q "^GH_TOKEN=" "$CONFIG"; then
                sed -i "s|^GH_TOKEN=.*|GH_TOKEN=$new_token|" "$CONFIG"
            else
                echo "GH_TOKEN=$new_token" >> "$CONFIG"
            fi
            echo "Updated GitHub token"
            ;;
        *)
            echo "Cancelled"
            ;;
    esac
}

cmd_projects() {
    load_config
    echo "Fetching projects..."
    local response
    response=$(curl -s -H "Authorization: Bearer $KANBAN_API_KEY" \
        "$KANBAN_API_URL/api/task-lists" 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$response" ]; then
        echo "Error: could not reach API"
        exit 1
    fi

    echo
    echo "Projects:"
    echo "─────────"
    # Parse JSON with node (available since we require Node.js 18+)
    echo "$response" | node -e "
        const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const lists = data.task_lists || [];
        if (!lists.length) { console.log('  (no projects)'); process.exit(0); }
        for (const p of lists) {
            const init = p.is_initialized ? 'yes' : 'no';
            const repo = p.repository_url || '(none)';
            console.log('  ' + p.id);
            console.log('    Name: ' + p.name);
            console.log('    Repo: ' + repo);
            console.log('    Initialized: ' + init);
            console.log();
        }
    "
}

cmd_init() {
    load_config
    local target_id="$1"

    if [ -z "$target_id" ]; then
        echo "Initializing all uninitialized projects..."
    else
        echo "Initializing project $target_id..."
    fi

    local response
    response=$(curl -s -H "Authorization: Bearer $KANBAN_API_KEY" \
        "$KANBAN_API_URL/api/task-lists" 2>/dev/null)

    echo "$response" | node -e "
        const fs = require('fs');
        const { execSync } = require('child_process');
        const data = JSON.parse(fs.readFileSync('/dev/stdin','utf8'));
        const lists = data.task_lists || [];
        const targetId = process.argv[1] || '';
        const projectsDir = process.argv[2];
        const apiUrl = process.argv[3];
        const apiKey = process.argv[4];
        const ghToken = process.argv[5] || '';

        for (const p of lists) {
            if (targetId && p.id !== targetId) continue;
            if (p.is_initialized) { console.log('  ' + p.id + ': already initialized'); continue; }
            if (!p.repository_url) { console.log('  ' + p.id + ': no repository URL'); continue; }

            const dir = projectsDir + '/' + p.id;
            if (fs.existsSync(dir)) {
                console.log('  ' + p.id + ': directory exists, marking initialized');
            } else {
                console.log('  ' + p.id + ': cloning ' + p.repository_url);
                let cloneUrl = p.repository_url;
                if (ghToken && cloneUrl.startsWith('https://github.com/')) {
                    cloneUrl = cloneUrl.replace('https://github.com/', 'https://' + ghToken + '@github.com/');
                }
                try {
                    execSync('git clone ' + JSON.stringify(cloneUrl) + ' ' + JSON.stringify(dir), { stdio: 'inherit' });
                } catch (e) {
                    console.error('  ' + p.id + ': clone failed');
                    continue;
                }
            }

            // Mark initialized via API
            try {
                execSync('curl -s -X PATCH ' +
                    '-H \"Authorization: Bearer ' + apiKey + '\" ' +
                    '-H \"Content-Type: application/json\" ' +
                    '-d ' + JSON.stringify(JSON.stringify({ working_directory: dir, is_initialized: true })) + ' ' +
                    JSON.stringify(apiUrl + '/api/task-lists/' + p.id),
                    { stdio: 'pipe' });
                console.log('  ' + p.id + ': initialized');
            } catch (e) {
                console.error('  ' + p.id + ': failed to update API');
            }
        }
    " "$target_id" "$PROJECTS_DIR" "$KANBAN_API_URL" "$KANBAN_API_KEY" "$GH_TOKEN"
}

cmd_usage() {
    echo "Usage: taskinfa <command>"
    echo
    echo "Commands:"
    echo "  start      Start the orchestrator daemon"
    echo "  stop       Stop the orchestrator"
    echo "  restart    Restart the orchestrator"
    echo "  status     Show orchestrator status"
    echo "  logs       Tail orchestrator logs"
    echo "  doctor     Run health checks"
    echo "  update     Update CLI, orchestrator, and skills"
    echo "  auth       Reconfigure credentials"
    echo "  projects   List projects from API"
    echo "  init [id]  Clone project(s) immediately"
}

case "${1:-}" in
    start)    cmd_start ;;
    stop)     cmd_stop ;;
    restart)  cmd_restart ;;
    status)   cmd_status ;;
    logs)     cmd_logs ;;
    doctor)   cmd_doctor ;;
    update)   cmd_update ;;
    auth)     cmd_auth ;;
    projects) cmd_projects ;;
    init)     cmd_init "$2" ;;
    *)        cmd_usage ;;
esac
EOFCLI

chmod +x "$TASKINFA_HOME/bin/taskinfa"
ok "Created CLI at $TASKINFA_HOME/bin/taskinfa"

# ── Add to PATH ───────────────────────────────────────────────────

SHELL_RC=""
if [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.profile" ]; then
    SHELL_RC="$HOME/.profile"
fi

PATH_LINE="export PATH=\"$TASKINFA_HOME/bin:\$PATH\""

if [ -n "$SHELL_RC" ]; then
    if ! grep -qF "$TASKINFA_HOME/bin" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# Taskinfa CLI" >> "$SHELL_RC"
        echo "$PATH_LINE" >> "$SHELL_RC"
        ok "Added to PATH in $SHELL_RC"
    else
        ok "PATH already configured in $SHELL_RC"
    fi
else
    warn "Could not detect shell rc file. Add this to your shell profile:"
    echo "  $PATH_LINE"
fi

# ── Summary ───────────────────────────────────────────────────────

echo
echo "────────────────────────────────────────"
echo -e "${GREEN}${BOLD}Installation complete!${NC}"
echo "────────────────────────────────────────"
echo
echo "Paths:"
echo "  Home:     $TASKINFA_HOME"
echo "  Projects: $PROJECTS_DIR"
echo "  CLI:      $TASKINFA_HOME/bin/taskinfa"
echo "  Config:   $TASKINFA_HOME/config.env"
echo
echo "Next steps:"
echo "  1. Open a new terminal (or run: source $SHELL_RC)"
echo "  2. Run: taskinfa doctor     — verify everything is working"
echo "  3. Run: taskinfa start      — start the orchestrator"
echo "  4. Run: taskinfa status     — check it's running"
echo
echo "Create projects in the dashboard, and the orchestrator will"
echo "auto-clone repos and start processing tasks."
echo
