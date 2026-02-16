# dev.sh - Intelligent Port Management Guide

This guide explains how the `dev.sh` script provides intelligent port conflict resolution for local development.

## The Problem

When working on multiple projects or running the same project twice, you encounter port conflicts:

```bash
# Terminal 1
cd ~/workspace/taskinfa-kanban
npm run dev
# ✓ Running on http://localhost:3000

# Terminal 2
cd ~/workspace/taskinfa-kanban
npm run dev
# ✗ Error: Port 3000 is already in use
```

Or when working on multiple projects:

```bash
# Terminal 1 - Another project
cd ~/workspace/other-project
npm run dev
# ✓ Running on http://localhost:3000

# Terminal 2 - Taskinfa
cd ~/workspace/taskinfa-kanban
npm run dev
# ✗ Error: Port 3000 is already in use
```

## The Solution

The `dev.sh` script solves this with **intelligent port conflict resolution**:

1. **Same-project detection** - If the port is already used by this project, it gracefully exits
2. **Automatic port increment** - If the port is used by another project, it finds the next available port
3. **Health checks** - Verifies the server actually started before reporting success

---

## How It Works

### 1. Same-Project Detection

**Algorithm:**

```
1. Check if port is occupied → Yes
2. Get process ID (PID) using that port
3. Get working directory (CWD) of that process
4. Compare process CWD with current project directory
5. If same project → Exit gracefully (already running)
6. If different project → Find next available port
```

**Implementation:**

```bash
# Get PID of process using port 3000
lsof -Pi :3000 -sTCP:LISTEN -t

# Get working directory of that process
lsof -p $pid | grep cwd | awk '{print $9}'  # macOS
readlink -f /proc/$pid/cwd                   # Linux

# Compare with current project directory
if [[ "$process_cwd" == "$PROJECT_DIR"* ]]; then
    # Same project - already running!
fi
```

**Example:**

```bash
# Terminal 1
cd ~/workspace/taskinfa-kanban
./dev.sh
# ✓ Dashboard running at http://localhost:3000

# Terminal 2 - same project
cd ~/workspace/taskinfa-kanban
./dev.sh

# Output:
╔════════════════════════════════════════╗
║   Dev server already running! ✓        ║
╚════════════════════════════════════════╝

Dashboard is running at: http://localhost:3000

To stop the server, press Ctrl+C in the terminal where it's running.
Or run: pkill -f 'next dev'
```

### 2. Incremental Port Finding

**Algorithm:**

```
1. Start from next port (3001)
2. Check if port is available
3. If not, try next port (3002)
4. Continue up to max_attempts (default: 20)
5. Return first available port or exit with error
```

**Implementation:**

```bash
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
```

**Example:**

```bash
# Terminal 1 - Another project
cd ~/workspace/other-project
npm run dev
# ✓ Running on http://localhost:3000

# Terminal 2 - Taskinfa
cd ~/workspace/taskinfa-kanban
./dev.sh

# Output:
⚠ Port 3000 is in use by another project
  Using alternative port: 3001

╔════════════════════════════════════════╗
║        Development server ready!       ║
╚════════════════════════════════════════╝

Dashboard:   http://localhost:3001
```

### 3. Health Checks

After starting the server, `dev.sh` performs health checks:

```bash
# Wait up to 30 seconds for server to respond
MAX_RETRIES=30
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
        echo "✓ Dashboard is ready!"
        break
    fi

    sleep 1
done
```

If the server fails to start within 30 seconds, it shows an error and directs you to the logs.

---

## Usage Scenarios

### Scenario 1: First Time Running

```bash
cd ~/workspace/taskinfa-kanban
./dev.sh
```

**Output:**

```
╔════════════════════════════════════════╗
║  Taskinfa Kanban Local Development     ║
╚════════════════════════════════════════╝

Checking prerequisites...
✓ Node.js v20.11.0
✓ npm 10.2.4
✓ Claude CLI installed
✓ GitHub CLI installed

Installing dependencies...
✓ Dependencies installed

Creating .dev.vars configuration...
✓ Created .dev.vars with safe defaults

Checking ports...
✓ Port 3000 is available

Starting services...
Starting Next.js dashboard on port 3000...
Waiting for server to start...
✓ Dashboard is ready!

╔════════════════════════════════════════╗
║        Development server ready!       ║
╚════════════════════════════════════════╝

Dashboard:   http://localhost:3000
Logs:        tail -f /Users/you/workspace/taskinfa-kanban/.dev-dashboard.log

Press Ctrl+C to stop all services
```

### Scenario 2: Already Running (Same Project)

```bash
# Terminal 1
cd ~/workspace/taskinfa-kanban
./dev.sh
# Server running...

# Terminal 2
cd ~/workspace/taskinfa-kanban
./dev.sh
```

**Output:**

```
╔════════════════════════════════════════╗
║  Taskinfa Kanban Local Development     ║
╚════════════════════════════════════════╝

Checking prerequisites...
✓ Node.js v20.11.0
✓ npm 10.2.4

✓ Dependencies already installed
✓ .dev.vars already exists

Checking ports...

╔════════════════════════════════════════╗
║   Dev server already running! ✓        ║
╚════════════════════════════════════════╝

Dashboard is running at: http://localhost:3000

To stop the server, press Ctrl+C in the terminal where it's running.
Or run: pkill -f 'next dev'
```

### Scenario 3: Port Conflict (Different Project)

```bash
# Terminal 1 - Other project
cd ~/workspace/other-nextjs-app
npm run dev
# Running on port 3000

# Terminal 2 - Taskinfa
cd ~/workspace/taskinfa-kanban
./dev.sh
```

**Output:**

```
╔════════════════════════════════════════╗
║  Taskinfa Kanban Local Development     ║
╚════════════════════════════════════════╝

Checking prerequisites...
✓ Node.js v20.11.0
✓ npm 10.2.4

✓ Dependencies already installed
✓ .dev.vars already exists

Checking ports...
⚠ Port 3000 is in use by another project
  Using alternative port: 3001

Starting services...
Starting Next.js dashboard on port 3001...
Waiting for server to start...
✓ Dashboard is ready!

╔════════════════════════════════════════╗
║        Development server ready!       ║
╚════════════════════════════════════════╝

Dashboard:   http://localhost:3001
Logs:        tail -f /Users/you/workspace/taskinfa-kanban/.dev-dashboard.log

Press Ctrl+C to stop all services
```

### Scenario 4: Multiple Ports in Use

```bash
# Port 3000 - Other project A
# Port 3001 - Other project B
# Port 3002 - Other project C

cd ~/workspace/taskinfa-kanban
./dev.sh
```

**Output:**

```
Checking ports...
⚠ Port 3000 is in use by another project
  Using alternative port: 3003

Dashboard:   http://localhost:3003
```

The script automatically finds the next available port (3003).

---

## Configuration

### Changing Default Port

Edit `dev.sh` and modify the `DEFAULT_PORT` variable:

```bash
# Default port for Next.js dev server
DEFAULT_PORT=3000  # Change to your preferred port
```

### Changing Max Port Attempts

Edit the `find_available_port` function call:

```bash
# Try up to 50 ports instead of 20
APP_PORT=$(find_available_port $(($DEFAULT_PORT + 1)) 50)
```

### Changing Health Check Timeout

Edit the `MAX_RETRIES` variable:

```bash
MAX_RETRIES=30  # 30 seconds timeout (1 second per retry)
```

---

## Stopping Services

### Graceful Shutdown

Press **Ctrl+C** in the terminal where `dev.sh` is running.

The script will:
1. Kill the Next.js process
2. Clean up log files
3. Exit gracefully

### Manual Shutdown

If you closed the terminal without stopping the server:

```bash
# Find and kill the process
pkill -f 'next dev'

# Or find the specific process
lsof -i :3000
kill <PID>
```

---

## Logs

### Viewing Real-Time Logs

```bash
# In another terminal
tail -f .dev-dashboard.log
```

### Log Location

Logs are written to `.dev-dashboard.log` in the project root (gitignored).

### Log Cleanup

Logs are automatically cleaned up when you stop the server with Ctrl+C.

---

## Troubleshooting

### Script Says Port is Free, But Server Fails to Start

**Possible causes:**
- Another process grabbed the port between the check and server start
- Permission issues

**Solution:**
```bash
# Check what's actually using the port
lsof -i :3000

# Kill the process
pkill -f 'next dev'

# Try again
./dev.sh
```

### "Cannot Find Available Port" Error

This means ports 3001-3020 are all in use.

**Solution:**
```bash
# Check what's using your ports
lsof -i :3000-3020

# Stop some servers
pkill -f 'next dev'

# Or increase max attempts in dev.sh
```

### Server Starts But Health Check Fails

**Possible causes:**
- Server is slow to start
- Server crashed after starting
- Firewall blocking localhost

**Solution:**
```bash
# Check the logs
tail -f .dev-dashboard.log

# Try accessing manually
curl http://localhost:3000

# Increase timeout in dev.sh (MAX_RETRIES)
```

---

## Advanced Features

### Pre-Flight Checks

The script checks for required tools before starting:

- **Node.js** - Version 18+ required
- **npm** - Automatically installed with Node.js
- **Claude CLI** - Optional, warns if missing
- **GitHub CLI** - Optional, warns if missing

### Auto-Configuration

If `.dev.vars` doesn't exist, the script automatically creates it with:

- Random JWT secret (generated with `openssl rand -hex 32`)
- Safe development defaults
- Helpful comments

### Dependency Installation

If `node_modules` doesn't exist, the script runs `npm install` automatically.

---

## Comparison: Manual vs dev.sh

### Manual Start

```bash
# Check Node.js version manually
node -v

# Install dependencies manually
npm install

# Create .dev.vars manually
cat > packages/dashboard/.dev.vars << EOF
JWT_SECRET=$(openssl rand -hex 32)
EOF

# Start server (hope port is free)
cd packages/dashboard
npm run dev

# Server fails - port in use
# Find out what's using the port
lsof -i :3000

# Try different port manually
PORT=3001 npm run dev

# Oops, that's in use too
PORT=3002 npm run dev

# Finally works, but forget what port it's on
```

### With dev.sh

```bash
./dev.sh

# Done! ✓
```

---

## Why This Matters

### For Individual Developers

- **No more port conflicts** when working on multiple projects
- **No more manual setup** for new contributors
- **Consistent experience** across all SECAN projects
- **Faster onboarding** - clone and run

### For Teams

- **Reduces support burden** - fewer "it doesn't work on my machine" issues
- **Standardizes workflows** - everyone uses the same script
- **Easier code reviews** - consistent development environment
- **Better documentation** - one place to look for setup instructions

---

## Related Documentation

- **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** - Complete local development guide
- **[SECAN_DEV_ENV_WORKFLOW.md](/Users/cihanoezeren/workspace/SECAN_DEV_ENV_WORKFLOW.md)** - SECAN-wide development standards
- **[README.md](README.md)** - Project overview

---

**Questions?** Open an issue or check the [GitHub Discussions](https://github.com/secanltd/taskinfa-kanban/discussions).
