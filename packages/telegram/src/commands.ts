// Telegram bot command handlers

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
}

interface CommandContext {
  chatId: number;
  args: string;
  env: Env;
}

type CommandResult = { text: string; parse_mode?: 'Markdown' | 'HTML' };

// /status [project] — global or per-project status
export async function handleStatus(ctx: CommandContext): Promise<CommandResult> {
  const { env, args } = ctx;

  if (args) {
    // Per-project status
    const project = await env.DB.prepare(
      `SELECT tl.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.task_list_id = tl.id AND t.status = 'todo') as todo_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.task_list_id = tl.id AND t.status = 'in_progress') as in_progress_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.task_list_id = tl.id AND t.status = 'done') as done_count
       FROM task_lists tl
       WHERE tl.name LIKE ? OR tl.slug LIKE ?
       LIMIT 1`
    ).bind(`%${args}%`, `%${args}%`).first<any>();

    if (!project) {
      return { text: `Project "${args}" not found.` };
    }

    const sessions = await env.DB.prepare(
      `SELECT * FROM sessions WHERE project_id = ? AND status IN ('active', 'stuck') ORDER BY started_at DESC LIMIT 5`
    ).bind(project.id).all<any>();

    let text = `*${project.name}*\n\n`;
    text += `📝 Todo: ${project.todo_count}\n`;
    text += `⚡ In Progress: ${project.in_progress_count}\n`;
    text += `✅ Done: ${project.done_count}\n`;

    if (sessions.results && sessions.results.length > 0) {
      text += `\n*Active Sessions:*\n`;
      for (const s of sessions.results) {
        const icon = s.status === 'active' ? '🔵' : '🟡';
        text += `${icon} ${s.status}: ${s.summary || 'No summary'}\n`;
      }
    } else {
      text += `\n_No active sessions_`;
    }

    return { text, parse_mode: 'Markdown' };
  }

  // Global status
  const stats = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sessions WHERE status = 'active') as active_sessions,
      (SELECT COUNT(*) FROM sessions WHERE status = 'stuck') as stuck_sessions,
      (SELECT COUNT(*) FROM tasks WHERE status = 'todo') as todo_tasks,
      (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as in_progress_tasks,
      (SELECT COUNT(*) FROM tasks WHERE status = 'done') as done_tasks,
      (SELECT COUNT(*) FROM task_lists) as total_projects
  `).first<any>();

  if (!stats) {
    return { text: 'Could not fetch status.' };
  }

  let text = `*Taskinfa Kanban Status*\n\n`;
  text += `🔵 Active Sessions: ${stats.active_sessions}\n`;
  text += `🟡 Stuck: ${stats.stuck_sessions}\n\n`;
  text += `📝 Todo: ${stats.todo_tasks}\n`;
  text += `⚡ In Progress: ${stats.in_progress_tasks}\n`;
  text += `✅ Done: ${stats.done_tasks}\n`;
  text += `📁 Projects: ${stats.total_projects}`;

  return { text, parse_mode: 'Markdown' };
}

// /tasks — list pending tasks
export async function handleTasks(ctx: CommandContext): Promise<CommandResult> {
  const { env } = ctx;

  const tasks = await env.DB.prepare(
    `SELECT t.*, tl.name as project_name
     FROM tasks t
     LEFT JOIN task_lists tl ON t.task_list_id = tl.id
     WHERE t.status IN ('todo', 'in_progress')
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       t.created_at ASC
     LIMIT 20`
  ).all<any>();

  if (!tasks.results || tasks.results.length === 0) {
    return { text: '_No pending tasks._', parse_mode: 'Markdown' };
  }

  let text = '*Pending Tasks:*\n\n';
  for (const task of tasks.results) {
    const priorityIcon = task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🔵' : '⚪';
    const statusIcon = task.status === 'in_progress' ? '⚡' : '📝';
    text += `${statusIcon} ${priorityIcon} *${task.title}*`;
    if (task.project_name) text += ` _(${task.project_name})_`;
    text += '\n';
  }

  return { text, parse_mode: 'Markdown' };
}

// /new <project> <title> — create a new task
export async function handleNew(ctx: CommandContext): Promise<CommandResult> {
  const { env, args } = ctx;

  if (!args) {
    return { text: 'Usage: `/new <project> <task title>`', parse_mode: 'Markdown' };
  }

  const parts = args.split(' ');
  if (parts.length < 2) {
    return { text: 'Usage: `/new <project> <task title>`', parse_mode: 'Markdown' };
  }

  const projectQuery = parts[0];
  const title = parts.slice(1).join(' ');

  // Find project
  const project = await env.DB.prepare(
    `SELECT * FROM task_lists WHERE name LIKE ? OR slug LIKE ? LIMIT 1`
  ).bind(`%${projectQuery}%`, `%${projectQuery}%`).first<any>();

  if (!project) {
    return { text: `Project "${projectQuery}" not found.` };
  }

  // Get next order
  const maxOrder = await env.DB.prepare(
    `SELECT COALESCE(MAX("order"), -1) as max_order FROM tasks WHERE task_list_id = ? AND status = 'todo'`
  ).bind(project.id).first<any>();

  const taskId = `task_${crypto.randomUUID().replace(/-/g, '').slice(0, 21)}`;

  await env.DB.prepare(
    `INSERT INTO tasks (id, workspace_id, task_list_id, title, status, priority, labels, files_changed, "order")
     VALUES (?, ?, ?, ?, 'todo', 'medium', '[]', '[]', ?)`
  ).bind(taskId, project.workspace_id, project.id, title, (maxOrder?.max_order ?? -1) + 1).run();

  return {
    text: `✅ Created task in *${project.name}*:\n_${title}_`,
    parse_mode: 'Markdown',
  };
}

// /help — list commands
export async function handleHelp(): Promise<CommandResult> {
  return {
    text: [
      '*Taskinfa Kanban Bot*\n',
      '`/status` — Global overview',
      '`/status <project>` — Per-project status',
      '`/tasks` — List pending tasks',
      '`/new <project> <title>` — Create a task',
      '`/help` — This message',
    ].join('\n'),
    parse_mode: 'Markdown',
  };
}
