// Taskinfa Kanban Telegram Bot — Cloudflare Worker
// Webhook handler for Telegram bot commands

import { handleStatus, handleTasks, handleNew, handleHelp } from './commands';

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
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

async function handleUpdate(update: TelegramUpdate, env: Env) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  // Parse command and args
  const match = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)?$/s);
  if (!match) {
    // Free text — respond with help
    await sendReply(env.TELEGRAM_BOT_TOKEN, chatId, 'Use /help to see available commands.');
    return;
  }

  const command = match[1].toLowerCase();
  const args = (match[2] || '').trim();
  const ctx = { chatId, args, env };

  let result: { text: string; parse_mode?: string };

  switch (command) {
    case 'start':
      // Store chat_id for notifications
      try {
        await env.DB.prepare(
          `INSERT INTO notification_config (id, workspace_id, telegram_chat_id, telegram_enabled)
           VALUES (?, 'default', ?, 1)
           ON CONFLICT(workspace_id) DO UPDATE SET telegram_chat_id = ?, telegram_enabled = 1, updated_at = datetime('now')`
        ).bind(
          crypto.randomUUID(),
          String(chatId),
          String(chatId)
        ).run();
      } catch {
        // May fail if workspace doesn't exist — that's ok
      }
      result = {
        text: '✅ *Taskinfa Kanban Bot connected!*\n\nYou\'ll receive notifications for stuck tasks, errors, and completions.\n\nUse /help to see commands.',
        parse_mode: 'Markdown',
      };
      break;
    case 'status':
      result = await handleStatus(ctx);
      break;
    case 'tasks':
      result = await handleTasks(ctx);
      break;
    case 'new':
      result = await handleNew(ctx);
      break;
    case 'help':
      result = await handleHelp();
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
      return new Response(JSON.stringify({ status: 'ok', bot: 'taskinfa-telegram' }), {
        headers: { 'Content-Type': 'application/json' },
      });
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
