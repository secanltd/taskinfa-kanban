// Outbound Telegram notification helper

interface SendMessageOptions {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

export async function sendTelegramMessage(opts: SendMessageOptions): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${opts.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode || 'Markdown',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatEventNotification(
  eventType: string,
  message: string,
  taskTitle?: string
): string {
  const emoji: Record<string, string> = {
    task_completed: '\u2705',
    stuck: '\u26a0\ufe0f',
    needs_input: '\u2753',
    error: '\u274c',
    session_start: '\u25b6\ufe0f',
    session_end: '\u23f9\ufe0f',
  };

  const icon = emoji[eventType] || '\u2139\ufe0f';
  const typeLabel = eventType.replace(/_/g, ' ').toUpperCase();

  let text = `${icon} *${typeLabel}*`;
  if (taskTitle) text += `\nTask: _${taskTitle}_`;
  if (message) text += `\n${message}`;

  return text;
}
