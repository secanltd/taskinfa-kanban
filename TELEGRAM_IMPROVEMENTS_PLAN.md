# Telegram → Claude Code Chat Bridge — Implementation Plan

## Context

The Telegram bot (`packages/telegram`) currently only handles slash commands (`/status`, `/tasks`, `/new`, `/help`, `/start`). When a user sends a normal text message (non-command), the bot replies with "Use /help to see available commands." — a dead end.

We want to enable **natural conversation with Claude Code** via Telegram. When a user sends a free-text message, it should be forwarded to a Claude Code instance running in the Docker container on the home device. Claude responds, and the response is sent back to the user via Telegram.

### Key Challenges

1. **CF Worker timeout:** The Telegram webhook handler is a Cloudflare Worker with a 30s execution limit. Claude Code responses can take 30s–5min.
2. **Session continuity:** Each Telegram chat (identified by `chat_id`) should maintain a persistent Claude Code conversation, so context builds up naturally.
3. **Concurrency:** If a user sends multiple messages before Claude finishes processing the first, messages must be queued and processed sequentially per chat_id.
4. **Network path:** The CF Worker runs on Cloudflare's edge. Claude Code runs in a Docker container on a home device behind NAT. We need a tunnel.

### Solution: Fire-and-Forget with Direct Response

```
User sends message in Telegram
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare Worker (packages/telegram)          │
│  1. Receives webhook POST                       │
│  2. Sends "typing" indicator to Telegram        │
│  3. POSTs {chat_id, text} to bridge via tunnel  │
│  4. Returns 200 to Telegram immediately         │
└─────────────────────────────────────────────────┘
         │ (via Cloudflare Tunnel)
         ▼
┌─────────────────────────────────────────────────┐
│  Bridge Service (scripts/bridge.ts)             │
│  1. Receives POST, enqueues, returns 202        │
│  2. Processes queue for this chat_id            │
│  3. Spawns: claude -p "message" --resume <id>   │
│  4. Captures stdout                             │
│  5. Sends response directly to Telegram API     │
└─────────────────────────────────────────────────┘
```

The CF Worker never waits for Claude's response — it fires the request and returns. The bridge handles the slow work and talks to Telegram directly.

---

## Architecture Overview

```
Telegram ──webhook──▶ CF Worker ──POST /chat──▶ cloudflared tunnel ──▶ Bridge HTTP Server
                         │                                                    │
                         │                                                    ├─ Session Map (chat_id → conversationId)
                         │                                                    ├─ Message Queue (per chat_id)
                         │                                                    ├─ Claude Code (spawn with --resume)
                         │                                                    │
                         │                                                    ▼
Telegram ◀──sendMessage──────────────────────────────────────────── Telegram Bot API
```

### Components

| Component | Location | Runtime | Role |
|-----------|----------|---------|------|
| Telegram Worker | `packages/telegram/src/index.ts` | CF Worker | Receive webhooks, route commands, forward free-text to bridge |
| Bridge Service | `scripts/bridge.ts` | Node.js (Docker) | HTTP server, session management, Claude Code spawning, Telegram responses |
| Cloudflare Tunnel | `cloudflared` on host | Daemon | Encrypted tunnel from CF edge to home device |
| Claude Code | CLI in Docker | Spawned process | The actual AI that processes messages |

---

## Detailed Implementation

### Step 1: Create `scripts/bridge.ts`

**Purpose:** HTTP server that receives messages from the CF Worker, spawns Claude Code, and sends responses back to Telegram.

**Location:** `scripts/bridge.ts` (alongside existing `scripts/orchestrator.ts`)

**Why a script, not a new package?** It runs on the home device alongside the orchestrator, uses the same `child_process` pattern for spawning Claude Code, and doesn't need CF Worker tooling. It shares the monorepo's TypeScript/tsx setup.

#### Configuration

```typescript
// Environment variables (loaded from .env or process.env)
const PORT = parseInt(process.env.BRIDGE_PORT || '8787', 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || '';
const BRIDGE_PROJECT_DIR = process.env.BRIDGE_PROJECT_DIR || '/workspace/taskinfa-projects/taskinfa-kanban';
const MAX_RESPONSE_LENGTH = 4096; // Telegram message limit
```

#### Session State Management

```typescript
interface QueueItem {
  text: string;
  messageId: number;
  resolve: () => void;
}

interface SessionState {
  conversationId: string | null;  // Claude Code conversation ID for --resume
  queue: QueueItem[];             // Pending messages
  processing: boolean;            // Whether a message is currently being processed
}

const sessions = new Map<number, SessionState>();  // chat_id → session

function getSession(chatId: number): SessionState {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { conversationId: null, queue: [], processing: false });
  }
  return sessions.get(chatId)!;
}
```

#### Claude Code Spawning

```typescript
import { spawn } from 'child_process';

interface ClaudeResult {
  output: string;
  conversationId: string | null;
}

function runClaude(message: string, conversationId: string | null, cwd: string): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const args = ['-p', message, '--output-format', 'json'];
    if (conversationId) {
      args.push('--resume', conversationId);
    }

    // NOTE: We intentionally do NOT use --dangerously-skip-permissions
    // Messages come from Telegram users — Claude should be analytical/read-only
    const proc = spawn('claude', args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin?.end();

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited ${code}: ${stderr.slice(-300)}`));
        return;
      }
      try {
        // --output-format json returns { result: "...", conversation_id: "..." }
        const parsed = JSON.parse(stdout);
        resolve({
          output: parsed.result || stdout,
          conversationId: parsed.conversation_id || null,
        });
      } catch {
        resolve({ output: stdout, conversationId: null });
      }
    });

    proc.on('error', reject);
  });
}
```

#### Message Queue Processor

```typescript
async function processQueue(chatId: number): Promise<void> {
  const session = getSession(chatId);
  if (session.processing || session.queue.length === 0) return;

  session.processing = true;
  const item = session.queue.shift()!;

  try {
    // Send "typing" indicator to Telegram
    await sendChatAction(chatId, 'typing');

    // Spawn Claude Code
    const result = await runClaude(item.text, session.conversationId, BRIDGE_PROJECT_DIR);

    // Store conversation ID for future --resume calls
    if (result.conversationId) {
      session.conversationId = result.conversationId;
    }

    // Send response to Telegram (chunked if > 4096 chars)
    await sendResponse(chatId, result.output);
  } catch (err) {
    await sendTelegram(chatId, `Error: ${String(err).slice(0, 200)}`);
  } finally {
    session.processing = false;
    item.resolve();
    // Process next message in queue (if any)
    processQueue(chatId);
  }
}
```

#### Telegram API Helpers

```typescript
async function sendTelegram(chatId: number, text: string): Promise<void> {
  // Send as plain text to avoid Markdown escaping issues with Claude's output
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendChatAction(chatId: number, action: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

async function sendResponse(chatId: number, text: string): Promise<void> {
  const chunks = chunkText(text, MAX_RESPONSE_LENGTH);
  for (const chunk of chunks) {
    await sendTelegram(chatId, chunk);
  }
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to break at newlines for readability
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}
```

#### HTTP Server

```typescript
import { createServer, IncomingMessage, ServerResponse } from 'http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'claude-bridge', activeSessions: sessions.size }));
    return;
  }

  // Auth check for all other endpoints
  if (BRIDGE_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${BRIDGE_SECRET}`) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
  }

  // POST /chat — receive a message to forward to Claude
  if (req.url === '/chat' && req.method === 'POST') {
    const body = await readBody(req);
    const { chat_id, text, message_id } = JSON.parse(body);

    const session = getSession(chat_id);
    const promise = new Promise<void>((resolve) => {
      session.queue.push({ text, messageId: message_id, resolve });
    });
    processQueue(chat_id);  // Start processing (non-blocking)

    // Return immediately — don't wait for Claude
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ queued: true, queueLength: session.queue.length }));
    return;
  }

  // POST /reset — clear conversation for a chat_id
  if (req.url === '/reset' && req.method === 'POST') {
    const body = await readBody(req);
    const { chat_id } = JSON.parse(body);
    sessions.delete(chat_id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ reset: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Claude bridge listening on port ${PORT}`);
});
```

#### Logging

Reuse orchestrator's log pattern:

```typescript
import { existsSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = process.env.TASKINFA_HOME
  ? join(process.env.TASKINFA_HOME, 'logs')
  : '/workspace/.memory';
const LOG_FILE = join(LOG_DIR, 'bridge.log');

function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string, data?: Record<string, unknown>) {
  const entry = `[${new Date().toISOString()}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, entry + '\n');
  } catch {
    console.log(entry);
  }
}
```

#### Graceful Shutdown

```typescript
const shutdown = () => {
  log('INFO', 'Shutting down bridge...');
  server.close();
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

---

### Step 2: Create `scripts/build-bridge.js`

Mirror `scripts/build-orchestrator.js`:

```javascript
const { execSync } = require('child_process');
const { version } = require('../package.json');

execSync(
  `npx esbuild scripts/bridge.ts --bundle --platform=node --target=node18 --outfile=dist/bridge.js --minify --define:__BRIDGE_VERSION__='"${version}"'`,
  { stdio: 'inherit' }
);

console.log(`Built bridge v${version} → dist/bridge.js`);
```

---

### Step 3: Add scripts to root `package.json`

Add to the `"scripts"` section:

```json
"bridge": "npx tsx --env-file=.env scripts/bridge.ts",
"build:bridge": "node scripts/build-bridge.js"
```

---

### Step 4: Modify `packages/telegram/src/index.ts`

#### 4a. Update `Env` interface (line 6-10)

```typescript
interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  DASHBOARD_URL?: string;
  BRIDGE_URL?: string;      // e.g. https://bridge.yourdomain.com
  BRIDGE_SECRET?: string;   // shared secret for auth
}
```

#### 4b. Replace non-command message handler (lines 170-183)

**Current code:**
```typescript
if (!match) {
  const workspaceId = await getLinkedWorkspace(env.DB, chatId);
  if (!workspaceId) {
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, getStartMessage(dashboardUrl), 'Markdown');
  } else {
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, 'Use /help to see available commands.');
  }
  return;
}
```

**New code:**
```typescript
if (!match) {
  const workspaceId = await getLinkedWorkspace(env.DB, chatId);
  if (!workspaceId) {
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, getStartMessage(dashboardUrl), 'Markdown');
    return;
  }

  // Forward to Claude Code bridge (fire-and-forget)
  if (env.BRIDGE_URL) {
    // Send typing indicator
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });

    // Fire request to bridge — returns 202 immediately
    try {
      await fetch(`${env.BRIDGE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.BRIDGE_SECRET || ''}`,
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          message_id: message.message_id,
        }),
      });
    } catch (err) {
      console.error('Bridge request failed:', err);
      await sendReply(env.TELEGRAM_BOT_TOKEN, chatId,
        'Claude is currently unavailable. Please try again later.');
    }
  } else {
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, 'Use /help to see available commands.');
  }
  return;
}
```

#### 4c. Add `/reset` command (in the switch block, before `default`)

```typescript
case 'reset':
  if (env.BRIDGE_URL) {
    try {
      await fetch(`${env.BRIDGE_URL}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.BRIDGE_SECRET || ''}`,
        },
        body: JSON.stringify({ chat_id: chatId }),
      });
      result = { text: 'Conversation reset. Send a message to start fresh.' };
    } catch {
      result = { text: 'Failed to reset conversation. Please try again.' };
    }
  } else {
    result = { text: 'Claude bridge is not configured.' };
  }
  break;
```

---

### Step 5: Update `packages/telegram/src/commands.ts`

Update `handleHelp()` to document the new features:

```typescript
export async function handleHelp(): Promise<CommandResult> {
  return {
    text: [
      '*Taskinfa Kanban Bot*\n',
      '*Commands:*',
      '`/status` — Global overview',
      '`/status <project>` — Per-project status',
      '`/tasks` — List pending tasks',
      '`/new <project> <title>` — Create a task',
      '`/reset` — Reset Claude conversation',
      '`/help` — This message\n',
      '*Chat:*',
      '_Send any message without a command to chat with Claude Code._\n',
      '_To re-link your account, just paste a new API key._',
    ].join('\n'),
    parse_mode: 'Markdown',
  };
}
```

---

### Step 6: Cloudflare Tunnel Setup

This is infrastructure setup, not code. Steps to run on the home device:

#### 6a. Create the tunnel

```bash
# Install cloudflared (if not already)
# On macOS: brew install cloudflared
# On Linux: see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Authenticate (opens browser)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create taskinfa-bridge

# Route DNS (replace yourdomain.com with your actual domain managed by Cloudflare)
cloudflared tunnel route dns taskinfa-bridge bridge.yourdomain.com
```

#### 6b. Create config file

`~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>  # From the create command output
credentials-file: /path/to/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: bridge.yourdomain.com
    service: http://localhost:8787
  - service: http_status:404
```

#### 6c. Run the tunnel

```bash
# Manual
cloudflared tunnel run taskinfa-bridge

# As a systemd service (Linux)
sudo cloudflared service install
sudo systemctl start cloudflared

# Or with pm2
pm2 start "cloudflared tunnel run taskinfa-bridge" --name cloudflared
```

#### 6d. Set secrets on the Telegram Worker

```bash
cd packages/telegram

# Test environment
wrangler secret put BRIDGE_URL --env test
# Enter: https://bridge.yourdomain.com

wrangler secret put BRIDGE_SECRET --env test
# Enter: <your-shared-secret>

# Production environment
wrangler secret put BRIDGE_URL --env production
wrangler secret put BRIDGE_SECRET --env production
```

#### 6e. Generate the shared secret

```bash
openssl rand -hex 32
# Use this value for both BRIDGE_SECRET on the worker and the bridge
```

---

## Security Considerations

### 1. No `--dangerously-skip-permissions`

The bridge does **NOT** use `--dangerously-skip-permissions` when spawning Claude Code. This means Claude in this mode will operate within its default permission model — it can read and analyze code but will ask for permission before making changes. Since there's no interactive stdin, it effectively becomes read-only/analytical.

If you want Claude to be able to make changes (write files, run commands), you would need `--dangerously-skip-permissions`, but this is a significant security risk when messages come from Telegram. **Recommendation: keep it read-only for now.**

### 2. Shared Secret Authentication

The `BRIDGE_SECRET` prevents unauthorized access to the bridge. The CF Worker sends it as a Bearer token; the bridge validates it on every request (except `/health`).

### 3. Workspace Linking Required

The CF Worker only forwards messages to the bridge if the Telegram chat is linked to a workspace (via `getLinkedWorkspace`). Unlinked chats still get the setup instructions.

### 4. Rate Limiting (future improvement)

Consider adding rate limiting per chat_id in the bridge (e.g., max 10 messages per minute) to prevent abuse.

---

## Environment Variables Summary

### Bridge Service (home device — `.env` file)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BRIDGE_PORT` | No | `8787` | HTTP server port |
| `TELEGRAM_BOT_TOKEN` | Yes | — | Same bot token as the CF Worker uses |
| `BRIDGE_SECRET` | Yes | — | Shared secret (generate with `openssl rand -hex 32`) |
| `BRIDGE_PROJECT_DIR` | No | `/workspace/taskinfa-projects/taskinfa-kanban` | Working directory for Claude Code |
| `TASKINFA_HOME` | No | — | Base directory for logs |

### Telegram CF Worker (wrangler secrets)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BRIDGE_URL` | No | — | Bridge tunnel hostname (e.g. `https://bridge.yourdomain.com`) |
| `BRIDGE_SECRET` | No | — | Shared secret for authenticating with bridge |

When `BRIDGE_URL` is not set, the bot falls back to the current "Use /help" behavior for non-command messages.

---

## Files to Create/Modify

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `scripts/bridge.ts` | **Create** | ~200 | Bridge HTTP server, session management, Claude spawning, Telegram responses |
| `scripts/build-bridge.js` | **Create** | ~10 | esbuild bundler (mirrors build-orchestrator.js) |
| `package.json` (root) | **Edit** | +2 | Add `bridge` and `build:bridge` scripts |
| `packages/telegram/src/index.ts` | **Edit** | ~30 | Add BRIDGE_URL/BRIDGE_SECRET to Env, forward non-command msgs, add /reset |
| `packages/telegram/src/commands.ts` | **Edit** | ~5 | Update help text with chat info and /reset |

---

## Running the Bridge

### Development

```bash
# Terminal 1: Run the bridge
npm run bridge

# Terminal 2: Test it
curl http://localhost:8787/health
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -d '{"chat_id":123456,"text":"What files are in this project?","message_id":1}'
```

### Production

```bash
# With pm2 (recommended)
pm2 start scripts/bridge.ts --name bridge --interpreter "npx" --interpreter-args "tsx"

# Or with the built version
npm run build:bridge
pm2 start dist/bridge.js --name bridge

# Alongside cloudflared
pm2 start "cloudflared tunnel run taskinfa-bridge" --name cloudflared
```

---

## Verification Checklist

1. [ ] Run bridge locally: `npm run bridge`
2. [ ] Test health endpoint: `curl http://localhost:8787/health`
3. [ ] Test chat endpoint with curl (verify Claude spawns and responds)
4. [ ] Test reset endpoint with curl
5. [ ] Test message chunking (send a prompt that generates a long response)
6. [ ] Test queue serialization (send multiple messages quickly)
7. [ ] Set up cloudflared tunnel
8. [ ] Set BRIDGE_URL and BRIDGE_SECRET as wrangler secrets
9. [ ] Deploy telegram worker
10. [ ] Send a normal message in Telegram → should get Claude's response
11. [ ] Send `/reset` → should confirm conversation reset
12. [ ] Send another message → should start a fresh conversation
13. [ ] Send `/help` → should show updated help text with chat info

---

## Future Improvements

- **Markdown formatting:** Try sending Claude's response with Telegram's MarkdownV2 parse mode, with proper escaping. Fall back to plain text on failure.
- **Rate limiting:** Add per-chat_id rate limiting in the bridge.
- **Conversation persistence:** Store conversation IDs in a file/DB so they survive bridge restarts.
- **Multi-project support:** Let users specify which project directory Claude should work in (via a `/project` command).
- **Interactive permissions:** Forward Claude's permission requests to Telegram and let users approve/deny via inline keyboards.
- **Image/file support:** Handle Telegram photos and documents, pass them to Claude.
- **Streaming:** Send partial responses as Claude generates them (requires polling Claude's output).
