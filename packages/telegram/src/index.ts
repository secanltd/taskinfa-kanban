// Taskinfa Kanban Telegram Bot — Cloudflare Worker
// Webhook handler for Telegram bot commands

import { handleStatus, handleTasks, handleNew, handleHelp } from './commands';

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  DASHBOARD_URL?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

async function sendReply(botToken: string, chatId: number, text: string, parseMode?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode || undefined,
    }),
  });
}

// Hash an API key the same way the dashboard does (SHA-256 hex)
async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify an API key against the shared D1 database
async function verifyApiKey(
  db: D1Database,
  apiKey: string
): Promise<{ workspaceId: string; workspaceName: string } | null> {
  const keyHash = await hashApiKey(apiKey);

  const record = await db
    .prepare(
      `SELECT ak.workspace_id, w.name as workspace_name
       FROM api_keys ak
       JOIN workspaces w ON w.id = ak.workspace_id
       WHERE ak.key_hash = ? AND ak.is_active = 1`
    )
    .bind(keyHash)
    .first<{ workspace_id: string; workspace_name: string }>();

  if (!record) return null;

  // Check expiration
  const expRecord = await db
    .prepare(`SELECT expires_at FROM api_keys WHERE key_hash = ?`)
    .bind(keyHash)
    .first<{ expires_at: string | null }>();

  if (expRecord?.expires_at && new Date(expRecord.expires_at) < new Date()) {
    return null;
  }

  return { workspaceId: record.workspace_id, workspaceName: record.workspace_name };
}

// Look up workspace for a Telegram chat
export async function getLinkedWorkspace(
  db: D1Database,
  chatId: number
): Promise<string | null> {
  const config = await db
    .prepare(
      `SELECT workspace_id FROM notification_config
       WHERE telegram_chat_id = ? AND telegram_enabled = 1`
    )
    .bind(String(chatId))
    .first<{ workspace_id: string }>();

  return config?.workspace_id || null;
}

function getStartMessage(dashboardUrl: string): string {
  return [
    '*Welcome to Taskinfa Kanban Bot!* 🎯\n',
    'To get started, I need to link your Telegram account to your Kanban board.\n',
    '*How to connect:*',
    `1. Open your dashboard: ${dashboardUrl}/settings`,
    '2. Scroll to *API Keys* section',
    '3. Click *Create API Key*',
    '4. Name it `Telegram Bot`',
    '5. Copy the key (starts with `tk_`)',
    '6. Paste it right here in this chat\n',
    '_Your API key is only used once to link your account. It is not stored._',
  ].join('\n');
}

async function handleApiKeyInput(
  chatId: number,
  apiKey: string,
  env: Env
): Promise<{ text: string; parse_mode?: string }> {
  const result = await verifyApiKey(env.DB, apiKey);

  if (!result) {
    return {
      text: '❌ Invalid or expired API key. Please check and try again.\n\nUse /start to see setup instructions.',
      parse_mode: 'Markdown',
    };
  }

  // Store the link: telegram_chat_id → workspace_id
  // Upsert: if this chat was already linked, update it
  // If this workspace already has a config, update the chat_id
  const existing = await env.DB
    .prepare(`SELECT id FROM notification_config WHERE workspace_id = ?`)
    .bind(result.workspaceId)
    .first<{ id: string }>();

  if (existing) {
    await env.DB
      .prepare(
        `UPDATE notification_config
         SET telegram_chat_id = ?, telegram_enabled = 1, updated_at = datetime('now')
         WHERE workspace_id = ?`
      )
      .bind(String(chatId), result.workspaceId)
      .run();
  } else {
    await env.DB
      .prepare(
        `INSERT INTO notification_config (id, workspace_id, telegram_chat_id, telegram_enabled)
         VALUES (?, ?, ?, 1)`
      )
      .bind(crypto.randomUUID(), result.workspaceId, String(chatId))
      .run();
  }

  return {
    text: `✅ *Connected!*\n\nLinked to workspace: *${result.workspaceName}*\n\nYou'll now receive notifications when tasks complete, get stuck, or need input.\n\nUse /help to see available commands.`,
    parse_mode: 'Markdown',
  };
}

async function handleUpdate(update: TelegramUpdate, env: Env) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const dashboardUrl = env.DASHBOARD_URL || 'https://taskinfa-kanban-test.secan-ltd.workers.dev';

  // Check if this is an API key paste (starts with tk_)
  if (text.startsWith('tk_')) {
    const result = await handleApiKeyInput(chatId, text, env);
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, result.text, result.parse_mode);
    return;
  }

  // Parse command and args
  const match = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)?$/s);
  if (!match) {
    // Check if linked
    const workspaceId = await getLinkedWorkspace(env.DB, chatId);
    if (!workspaceId) {
      await sendReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        getStartMessage(dashboardUrl),
        'Markdown'
      );
    } else {
      await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, 'Use /help to see available commands.');
    }
    return;
  }

  const command = match[1].toLowerCase();
  const args = (match[2] || '').trim();

  // /start and /help don't require linking
  if (command === 'start') {
    // Check if already linked
    const workspaceId = await getLinkedWorkspace(env.DB, chatId);
    if (workspaceId) {
      await sendReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        '✅ You\'re already connected! Use /help to see commands.\n\nTo re-link with a different account, just paste a new API key.',
        'Markdown'
      );
    } else {
      await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, getStartMessage(dashboardUrl), 'Markdown');
    }
    return;
  }

  if (command === 'help') {
    const result = await handleHelp();
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, result.text, result.parse_mode);
    return;
  }

  // All other commands require linking
  const workspaceId = await getLinkedWorkspace(env.DB, chatId);
  if (!workspaceId) {
    await sendReply(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      '⚠️ You need to link your account first.\n\nSend /start to see setup instructions.',
      'Markdown'
    );
    return;
  }

  const ctx = { chatId, args, env, workspaceId };
  let result: { text: string; parse_mode?: string };

  switch (command) {
    case 'status':
      result = await handleStatus(ctx);
      break;
    case 'tasks':
      result = await handleTasks(ctx);
      break;
    case 'new':
      result = await handleNew(ctx);
      break;
    default:
      result = { text: `Unknown command: /${command}. Use /help for available commands.` };
  }

  await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, result.text, result.parse_mode);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', bot: 'taskinfa-telegram' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Telegram webhook endpoint
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        const update: TelegramUpdate = await request.json();
        await handleUpdate(update, env);
        return new Response('ok');
      } catch (err) {
        console.error('Webhook error:', err);
        return new Response('error', { status: 500 });
      }
    }

    // Register webhook (manual setup endpoint)
    if (url.pathname === '/register-webhook') {
      const webhookUrl = `${url.origin}/webhook`;
      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Taskinfa Telegram Bot', { status: 200 });
  },
};
