#!/usr/bin/env npx tsx
/**
 * Orchestrator Daemon — the heartbeat of taskinfa-kanban v2
 *
 * Polls the kanban API every 15 minutes, starts Claude Code sessions
 * for projects with pending tasks, manages concurrency and retries.
 *
 * Usage:
 *   npx tsx scripts/orchestrator.ts
 *   pm2 start scripts/orchestrator.ts --name orchestrator --interpreter "npx" --interpreter-args "tsx"
 *
 * Environment variables:
 *   KANBAN_API_URL  — Dashboard API base URL (e.g. https://kanban.taskinfa.com)
 *   KANBAN_API_KEY  — API key for authentication (Bearer token)
 *   POLL_INTERVAL   — Polling interval in ms (default: 900000 = 15 min)
 *   MAX_CONCURRENT  — Max parallel Claude sessions (default: 3)
 *   MAX_RETRIES     — Max retries per task before marking blocked (default: 3)
 *   SESSION_TIMEOUT_MS — Session timeout in ms before marking stuck (default: 2700000 = 45 min)
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Version (injected at build time by esbuild) ─────────────────────

declare const __ORCHESTRATOR_VERSION__: string;
const VERSION = typeof __ORCHESTRATOR_VERSION__ !== 'undefined' ? __ORCHESTRATOR_VERSION__ : 'dev';

// ── Config.env loading ──────────────────────────────────────────────

const CONFIG_FILE = process.env.TASKINFA_CONFIG || '';
if (CONFIG_FILE && existsSync(CONFIG_FILE)) {
  const lines = readFileSync(CONFIG_FILE, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ── Config ──────────────────────────────────────────────────────────

const API_URL = process.env.KANBAN_API_URL || 'http://localhost:3000';
const API_KEY = process.env.KANBAN_API_KEY || '';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '900000', 10); // 15 min
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || String(45 * 60 * 1000), 10); // 45 min default
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/workspace';
const TASKINFA_HOME = process.env.TASKINFA_HOME || '';
const PROJECTS_DIR = process.env.PROJECTS_DIR || join(WORKSPACE_ROOT, 'projects');
const GH_TOKEN = process.env.GH_TOKEN || '';
const LOG_DIR = TASKINFA_HOME ? join(TASKINFA_HOME, 'logs') : join(WORKSPACE_ROOT, '.memory');
const LOG_FILE = join(LOG_DIR, 'orchestrator.log');

// Clean env for child Claude processes — remove CLAUDECODE to prevent
// "cannot launch inside another Claude Code session" errors
const { CLAUDECODE: _dropClaude, ...CLEAN_ENV } = process.env;

// Track active Claude processes
const activeSessions = new Map<string, { process: ChildProcess; sessionId: string; taskId: string; startedAt: number }>();

// ── Logging ─────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string, data?: Record<string, unknown>) {
  const entry = `[${new Date().toISOString()}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, entry + '\n');
  } catch {
    // Fall back to stdout if file write fails
    console.log(entry);
  }
}

// ── API helpers ─────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

async function parseApiError(method: string, path: string, res: Response): Promise<string> {
  try {
    const body = await res.text();
    // Try to extract structured error message from JSON response
    try {
      const json = JSON.parse(body) as { error?: string; category?: string };
      const parts = [`API ${method} ${path} failed (${res.status})`];
      if (json.error) parts.push(json.error);
      if (json.category) parts.push(`[${json.category}]`);
      return parts.join(': ');
    } catch {
      return `API ${method} ${path} failed (${res.status}): ${body.slice(0, 500)}`;
    }
  } catch {
    return `API ${method} ${path} failed (${res.status})`;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const errorMsg = await parseApiError('GET', path, res);
    log('ERROR', errorMsg);
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError('POST', path, res);
    log('ERROR', errorMsg);
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorMsg = await parseApiError('PATCH', path, res);
    log('ERROR', errorMsg);
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_list_id: string | null;
  parent_task_id: string | null;
  error_count: number;
  review_rounds: number;
  pr_url: string | null;
  branch_name: string | null;
  claude_session_id: string | null;
  labels: string[];
  completion_notes: string | null;
  is_blocked?: boolean;
}

interface TaskList {
  id: string;
  name: string;
  working_directory: string;
  repository_url: string | null;
  is_initialized: boolean;
  slug: string | null;
}

interface Session {
  id: string;
  project_id: string | null;
  current_task_id: string | null;
  status: string;
}

interface FeatureToggle {
  feature_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

// ── Project initialization ──────────────────────────────────────────

function toHttpsUrl(repoUrl: string): string {
  // git@github.com:owner/repo.git → https://github.com/owner/repo.git
  const sshMatch = repoUrl.match(/^git@github\.com:(.+)$/);
  if (sshMatch) return `https://github.com/${sshMatch[1]}`;
  // ssh://git@github.com/owner/repo → https://github.com/owner/repo
  const sshProtoMatch = repoUrl.match(/^ssh:\/\/git@github\.com\/(.+)$/);
  if (sshProtoMatch) return `https://github.com/${sshProtoMatch[1]}`;
  return repoUrl;
}

function gitClone(repoUrl: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cloneUrl = toHttpsUrl(repoUrl);
    if (GH_TOKEN && cloneUrl.startsWith('https://github.com/')) {
      cloneUrl = cloneUrl.replace('https://github.com/', `https://${GH_TOKEN}@github.com/`);
    }
    const proc = spawn('git', ['clone', cloneUrl, dest], { stdio: 'pipe' });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone failed (exit ${code}): ${stderr.slice(-200)}`));
    });
    proc.on('error', reject);
  });
}

async function initializeProjects(): Promise<void> {
  const { task_lists } = await apiGet<{ task_lists: TaskList[] }>('/api/task-lists');

  for (const project of task_lists) {
    if (project.is_initialized) continue;
    if (!project.repository_url) continue;

    const projectDir = join(PROJECTS_DIR, project.id);

    if (existsSync(projectDir)) {
      log('INFO', 'Project directory exists, marking initialized', { projectId: project.id });
      try {
        await apiPatch(`/api/task-lists/${project.id}`, {
          working_directory: projectDir,
          is_initialized: true,
        });
      } catch (e) {
        log('ERROR', 'Failed to mark project initialized', { projectId: project.id, error: String(e) });
      }
      continue;
    }

    log('INFO', 'Cloning project repository', { projectId: project.id, repo: project.repository_url });
    try {
      await gitClone(project.repository_url, projectDir);
      await apiPatch(`/api/task-lists/${project.id}`, {
        working_directory: projectDir,
        is_initialized: true,
      });
      log('INFO', 'Project initialized', { projectId: project.id, dir: projectDir });
    } catch (e) {
      log('ERROR', 'Failed to initialize project', { projectId: project.id, error: String(e) });
    }
  }
}

// ── Core logic ──────────────────────────────────────────────────────

async function getProjectTasks(): Promise<Map<string, Task[]>> {
  const { tasks } = await apiGet<{ tasks: Task[] }>('/api/tasks?status=todo&limit=100');
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    // Skip subtasks (handled by parent) and blocked tasks
    if (task.parent_task_id) continue;
    if (task.is_blocked) continue;

    const projectId = task.task_list_id || 'default';
    if (!grouped.has(projectId)) grouped.set(projectId, []);
    grouped.get(projectId)!.push(task);
  }

  return grouped;
}

async function getActiveSessions(): Promise<Set<string>> {
  const { sessions } = await apiGet<{ sessions: Session[] }>('/api/sessions?status=active');

  // Orphan cleanup: if API shows active sessions that don't exist locally,
  // mark them as errors (handles orchestrator crash/restart scenarios)
  for (const session of sessions) {
    const projectId = session.project_id;
    if (!projectId) continue;
    if (activeSessions.has(projectId)) continue;

    // API says active but we have no local process — this is an orphan
    log('WARN', 'Cleaning up orphan session (no local process)', {
      sessionId: session.id, projectId,
    });

    try {
      await apiPatch(`/api/sessions/${session.id}`, {
        status: 'error',
        summary: 'Orphan session: orchestrator restarted while session was active',
      });
    } catch (e) {
      log('ERROR', 'Failed to mark orphan session as error', { error: String(e) });
    }

    // Reset the orphan's task to todo so it can be picked up again
    if (session.current_task_id) {
      try {
        const { task } = await apiGet<{ task: Task }>(`/api/tasks/${session.current_task_id}`);
        await apiPatch(`/api/tasks/${session.current_task_id}`, {
          status: 'todo',
          assigned_to: null,
          error_count: (task.error_count || 0) + 1,
        });
      } catch (e) {
        log('ERROR', 'Failed to reset orphan task', { error: String(e) });
      }
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_error',
        session_id: session.id,
        message: 'Orphan session detected after orchestrator restart. Session marked as error, task reset to todo.',
      });
    } catch (e) {
      log('ERROR', 'Failed to post orphan session event', { error: String(e) });
    }
  }

  // Return only sessions that have a local process (orphans have been cleaned up)
  const activeProjectIds = new Set<string>();
  for (const session of sessions) {
    if (session.project_id && activeSessions.has(session.project_id)) {
      activeProjectIds.add(session.project_id);
    }
  }
  return activeProjectIds;
}

async function getProjectInfo(projectId: string): Promise<TaskList | null> {
  try {
    const { task_list } = await apiGet<{ task_list: TaskList }>(`/api/task-lists/${projectId}`);
    return task_list;
  } catch (e) {
    log('WARN', 'Failed to fetch project info', { projectId, error: String(e) });
    return null;
  }
}

async function getFeatureToggles(): Promise<FeatureToggle[]> {
  try {
    const { toggles } = await apiGet<{ toggles: FeatureToggle[] }>('/api/feature-toggles');
    return toggles;
  } catch (e) {
    log('WARN', 'Failed to fetch feature toggles, assuming none enabled', { error: String(e) });
    return [];
  }
}

function isAiReviewEnabled(toggles: FeatureToggle[]): boolean {
  const toggle = toggles.find(t => t.feature_key === 'ai_review');
  return toggle?.enabled ?? false;
}

function getAiReviewConfig(toggles: FeatureToggle[]): { max_review_rounds: number; auto_advance_on_approve: boolean } {
  const toggle = toggles.find(t => t.feature_key === 'ai_review');
  const config = toggle?.config as Record<string, unknown> | undefined;
  return {
    max_review_rounds: (config?.max_review_rounds as number) ?? 3,
    auto_advance_on_approve: (config?.auto_advance_on_approve as boolean) ?? true,
  };
}

function isLocalTestingEnabled(toggles: FeatureToggle[]): boolean {
  const toggle = toggles.find(t => t.feature_key === 'local_testing');
  return toggle?.enabled ?? false;
}

function getLocalTestingConfig(toggles: FeatureToggle[]): { auto_advance_on_pass: boolean } {
  const toggle = toggles.find(t => t.feature_key === 'local_testing');
  const config = toggle?.config as Record<string, unknown> | undefined;
  return { auto_advance_on_pass: (config?.auto_advance_on_pass as boolean) ?? true };
}

async function getTasksByStatus(status: string): Promise<Map<string, Task[]>> {
  const { tasks } = await apiGet<{ tasks: Task[] }>(`/api/tasks?status=${status}&limit=100`);
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    const projectId = task.task_list_id || 'default';
    if (!grouped.has(projectId)) grouped.set(projectId, []);
    grouped.get(projectId)!.push(task);
  }

  return grouped;
}

function isRefinementEnabled(toggles: FeatureToggle[]): boolean {
  const toggle = toggles.find(t => t.feature_key === 'refinement');
  return toggle?.enabled ?? false;
}

function getRefinementConfig(toggles: FeatureToggle[]): { auto_advance: boolean } {
  const toggle = toggles.find(t => t.feature_key === 'refinement');
  const config = toggle?.config as Record<string, unknown> | undefined;
  return { auto_advance: (config?.auto_advance as boolean) ?? true };
}

async function getRefinementTasks(): Promise<Map<string, Task[]>> {
  const grouped = await getTasksByStatus('refinement');
  const filtered = new Map<string, Task[]>();

  for (const [projectId, tasks] of grouped) {
    const eligibleTasks = tasks.filter(task => {
      // Parse labels (API may return JSON string or array)
      const labels = Array.isArray(task.labels)
        ? task.labels
        : typeof task.labels === 'string'
          ? (() => { try { return JSON.parse(task.labels as unknown as string); } catch { return []; } })()
          : [];

      // Skip tasks that already have the 'refined' label
      if (labels.includes('refined')) {
        log('INFO', 'Skipping already refined task', { taskId: task.id, title: task.title });
        return false;
      }
      return true;
    });

    if (eligibleTasks.length > 0) {
      filtered.set(projectId, eligibleTasks);
    }
  }

  return filtered;
}

function parseRepoSlug(repoUrl: string | null): string | null {
  if (!repoUrl) return null;
  // https://github.com/owner/repo.git → owner/repo
  // https://github.com/owner/repo → owner/repo
  // git@github.com:owner/repo.git → owner/repo
  const httpsMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];
  const sshMatch = repoUrl.match(/github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];
  return null;
}

function parsePrNumber(prUrl: string | null): string | null {
  if (!prUrl) return null;
  const match = prUrl.match(/\/pull\/(\d+)/);
  return match ? match[1] : null;
}

function generateBranchName(task: Task): string {
  const taskIdShort = task.id.replace('task_', '').slice(0, 8);
  const titleSlug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `task/${taskIdShort}/${titleSlug}`;
}

async function postBotComment(taskId: string, content: string, commentType: string = 'summary'): Promise<void> {
  try {
    await apiPost(`/api/tasks/${taskId}/comments`, {
      author: 'orchestrator',
      author_type: 'bot',
      content,
      comment_type: commentType,
    });
  } catch (e) {
    log('ERROR', 'Failed to post bot comment', { taskId, error: String(e) });
  }
}

function buildClaudeArgs(task: Task, prompt: string): string[] {
  const args: string[] = [];
  if (task.claude_session_id) {
    args.push('--resume', task.claude_session_id);
  }
  args.push('-p', prompt, '--dangerously-skip-permissions', '--output-format', 'json');
  return args;
}

async function saveClaudeSessionId(task: Task, stdout: string): Promise<void> {
  try {
    const output = JSON.parse(stdout);
    const sessionId = output.session_id;
    if (sessionId && sessionId !== task.claude_session_id) {
      await apiPatch(`/api/tasks/${task.id}`, { claude_session_id: sessionId });
      log('INFO', 'Saved Claude session ID to task', { taskId: task.id, claudeSessionId: sessionId });
    }
  } catch {
    // Non-JSON output or parse error, skip
  }
}

function extractTextFromJsonOutput(stdout: string): string {
  try {
    const output = JSON.parse(stdout);
    // Claude JSON output has a 'result' field with the text content
    return output.result || output.text || stdout;
  } catch {
    return stdout;
  }
}

function buildSystemPrompt(task: Task, project: TaskList | null): string {
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const memoryPath = join(workDir, '.memory', 'context.md');
  const claudeMdPath = join(workDir, 'CLAUDE.md');
  const branchName = task.branch_name || generateBranchName(task);

  // Build context preamble for task awareness
  const taskContext = `## Task Context
- Previous attempts: ${task.error_count}
- Branch: ${task.branch_name || 'none (fresh task)'}
- PR: ${task.pr_url || 'none'}
- Last notes: ${task.completion_notes || 'none'}

Before starting, assess the current state:
1. ${task.branch_name ? `Check if branch exists: git branch -a | grep ${task.branch_name}` : 'This is a fresh task — no existing branch.'}
2. ${task.pr_url ? `Check PR status: the PR is at ${task.pr_url}` : 'No PR exists yet.'}
3. Review previous session notes above
4. Read task comments for history from previous sessions:
   curl -s "$KANBAN_API_URL/api/tasks/$KANBAN_TASK_ID/comments" -H "Authorization: Bearer $KANBAN_API_KEY" | head -c 2000
Then decide: continue existing work or start fresh.
`;

  // Build git workflow based on existing branch/PR state
  let gitWorkflow = '';
  if (GH_TOKEN) {
    if (task.pr_url && task.branch_name) {
      // Existing branch AND PR — continue working on it
      gitWorkflow = `
## Git Workflow

An open PR already exists at ${task.pr_url} on branch \`${task.branch_name}\`.

1. Checkout existing branch: git checkout ${task.branch_name} && git pull origin ${task.branch_name}
2. Make your changes on this branch
3. Stage and commit: git add -A && git commit -m "fix: continue work on ${task.title.replace(/"/g, '\\"')}"
4. Push to existing branch: git push origin ${task.branch_name}

IMPORTANT: Do NOT create a new branch or a new PR. Push to the existing branch \`${task.branch_name}\`.
`;
    } else if (task.branch_name) {
      // Existing branch but no PR — checkout branch, create PR when done
      gitWorkflow = `
## Git Workflow

An existing branch \`${task.branch_name}\` exists for this task but no PR has been created yet.

1. Checkout existing branch: git checkout ${task.branch_name} && git pull origin ${task.branch_name}
2. Make your changes on this branch
3. Stage and commit: git add -A && git commit -m "feat: ${task.title.replace(/"/g, '\\"')}"
4. Push: git push -u origin ${task.branch_name}
5. Create PR: gh pr create --title "${task.title}" --body "Automated PR for task ${task.id}"
6. Capture the PR URL from the gh output, then update the task:
   curl -s -X PATCH "$KANBAN_API_URL/api/tasks/$KANBAN_TASK_ID" \\
     -H "Authorization: Bearer $KANBAN_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"pr_url":"<PR_URL>"}'
   (Replace <PR_URL> with the actual URL returned by gh pr create)

IMPORTANT: Do NOT create a new branch. Use the existing branch \`${task.branch_name}\`.
`;
    } else {
      // Fresh task — create new branch and PR
      gitWorkflow = `
## Git Workflow

After completing the task, create a PR for review:
1. Start from main: git checkout main && git pull origin main
2. Create branch: git checkout -b ${branchName}
3. Stage all changes including memory: git add -A
4. Commit (conventional commits, e.g. "feat: ..." or "fix: ...")
5. Push: git push -u origin ${branchName}
6. Create PR: gh pr create --title "${task.title}" --body "Automated PR for task ${task.id}"
7. Capture the PR URL from the gh output, then update the task:
   curl -s -X PATCH "$KANBAN_API_URL/api/tasks/$KANBAN_TASK_ID" \\
     -H "Authorization: Bearer $KANBAN_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"pr_url":"<PR_URL>","branch_name":"${branchName}"}'
   (Replace <PR_URL> with the actual URL returned by gh pr create)

IMPORTANT: You MUST create the branch, commit, push, and create the PR. The PR URL must be saved to the task.
`;
    }
  }

  return [
    `Project: ${project?.name || 'Unknown'}`,
    existsSync(claudeMdPath) ? `Read ${claudeMdPath} for project rules.` : '',
    existsSync(memoryPath) ? `Read ${memoryPath} for current context.` : '',
    '',
    taskContext,
    `Task: ${task.title}`,
    task.description || '',
    '',
    'Do the task. When done, update .memory/context.md with what you accomplished.',
    gitWorkflow,
    `
## Post Summary Comment

When you finish (success or failure), post a summary comment to the task:

\`\`\`bash
curl -s -X POST "$KANBAN_API_URL/api/tasks/$KANBAN_TASK_ID/comments" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"author":"orchestrator","author_type":"bot","content":"<SUMMARY_OF_WHAT_YOU_DID>","comment_type":"summary"}'
\`\`\`

Replace <SUMMARY_OF_WHAT_YOU_DID> with a brief summary including PR URL if you created one.
`,
  ].filter(Boolean).join('\n');
}

async function startClaudeSession(projectId: string, task: Task, options?: { aiReviewEnabled?: boolean; localTestingEnabled?: boolean }): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project', { projectId });
    return;
  }

  // Check retry limit
  if (task.error_count >= MAX_RETRIES) {
    log('WARN', 'Task exceeded retry limit, skipping', { taskId: task.id, errorCount: task.error_count });
    await apiPost('/api/events', {
      event_type: 'stuck',
      task_id: task.id,
      message: `Task blocked after ${task.error_count} failures. Manual intervention needed.`,
    });
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;

  // Register session with API
  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Working on: ${task.title}`,
  });

  const sessionId = session.id;
  const systemPrompt = buildSystemPrompt(task, project);

  log('INFO', 'Starting Claude session', { sessionId, projectId, taskId: task.id, taskTitle: task.title });

  // Report session start
  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Starting work on: ${task.title}`,
  });

  // Claim the task (move to in_progress)
  try {
    await apiPatch(`/api/tasks/${task.id}`, { status: 'in_progress', assigned_to: 'orchestrator' });
  } catch (e) {
    log('WARN', 'Failed to claim task, may already be claimed', { taskId: task.id });
  }

  // Spawn Claude Code (skip-permissions needed for non-interactive sessions
  // that must run bash commands like curl for progress reporting)
  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
      GH_TOKEN: GH_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Close stdin immediately — Claude CLI in -p mode doesn't need input
  // but may block if stdin pipe stays open
  claude.stdin?.end();

  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => {
    stdout += data.toString();
  });

  claude.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);

    // Handle --resume failure: if exit code indicates session not found, retry without resume
    if (code !== 0 && task.claude_session_id && stderr.includes('session')) {
      log('WARN', 'Claude --resume may have failed, retrying without resume', { taskId: task.id });
      task.claude_session_id = null;
      try {
        await apiPatch(`/api/tasks/${task.id}`, { claude_session_id: null });
        await startClaudeSession(projectId, task, options);
        return;
      } catch (retryErr) {
        log('ERROR', 'Retry without resume also failed', { error: String(retryErr) });
      }
    }

    const success = code === 0;
    const finalStatus = success ? 'completed' : 'error';

    log(success ? 'INFO' : 'ERROR', `Claude session ended`, {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    // Save Claude session ID for future resumption
    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    // Update session
    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: finalStatus,
        summary: success
          ? `Completed: ${task.title}`
          : `Error (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update session', { error: String(e) });
    }

    // Report session end
    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `Completed: ${task.title}`
          : `Failed (exit ${code}): ${stderr.slice(-200)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to report session end', { error: String(e) });
    }

    // Update task status
    try {
      const outputText = extractTextFromJsonOutput(stdout);
      if (success) {
        const nextStatus = options?.localTestingEnabled ? 'testing'
          : options?.aiReviewEnabled ? 'ai_review'
          : 'review';
        await apiPatch(`/api/tasks/${task.id}`, {
          status: nextStatus,
          completion_notes: outputText.slice(-1000),
        });
        if (nextStatus === 'testing') {
          log('INFO', 'Task moved to testing for local browser tests', { taskId: task.id });
        } else if (nextStatus === 'ai_review') {
          log('INFO', 'Task moved to ai_review for automated PR review', { taskId: task.id });
        }
      } else {
        await apiPatch(`/api/tasks/${task.id}`, {
          status: 'todo',
          error_count: task.error_count + 1,
          assigned_to: null,
        });
      }
    } catch (e) {
      log('ERROR', 'Failed to update task', { error: String(e) });
    }

    // Post bot comment with session result
    const nextStatusLabel = options?.localTestingEnabled ? 'testing'
      : options?.aiReviewEnabled ? 'ai_review'
      : 'review';
    const commentContent = success
      ? `Session completed successfully. Task moved to ${nextStatusLabel}.`
      : `Session failed (exit ${code}). Error count: ${task.error_count + 1}. ${stderr.slice(-300)}`;
    await postBotComment(task.id, commentContent, success ? 'summary' : 'error');
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

// ── AI Review sessions ──────────────────────────────────────────────

function buildAiReviewPrompt(task: Task, project: TaskList | null, config: { max_review_rounds: number; auto_advance_on_approve: boolean }): string {
  const repoSlug = parseRepoSlug(project?.repository_url ?? null);
  const prNumber = parsePrNumber(task.pr_url);
  const reviewRounds = task.review_rounds || 0;

  if (!repoSlug || !prNumber) {
    return `ERROR: Cannot review task "${task.title}" — missing repository URL or PR URL.
Repository URL: ${project?.repository_url || '(none)'}
PR URL: ${task.pr_url || '(none)'}

Please update the task with a valid pr_url and ensure the project has a repository_url configured.`;
  }

  return `You are an automated PR reviewer. Review the pull request and post your review to GitHub.

## Task Being Reviewed

**Task ID:** ${task.id}
**Title:** ${task.title}
**PR:** ${task.pr_url}
**Review Round:** ${reviewRounds + 1} of ${config.max_review_rounds}

## Step 1: Review the PR

Use the taskinfa-gh-pr-reviewer skill approach to review this PR:

\`\`\`bash
# Get PR metadata
gh pr view ${prNumber} --repo ${repoSlug} --json title,body,author,baseRefName,headRefName,files,additions,deletions,changedFiles

# Get the full diff
gh pr diff ${prNumber} --repo ${repoSlug}

# Get list of changed files
gh pr diff ${prNumber} --repo ${repoSlug} --name-only
\`\`\`

For each changed file, read the full content from the PR's head branch for line-accurate comments:

\`\`\`bash
# Get the head branch ref
gh pr view ${prNumber} --repo ${repoSlug} --json headRefName --jq '.headRefName'
\`\`\`

## Step 2: Analyze the diff

Review every changed file for:
1. **Bugs and logic errors** — incorrect conditions, off-by-one, null/undefined access, race conditions
2. **Behavioral regressions** — changes that break existing behavior or API contracts
3. **Missing error handling** — unhandled promise rejections, missing try/catch
4. **Security concerns** — XSS, injection, exposed secrets
5. **Dead code** — unused imports, unreachable branches

## Step 3: Post the review

Create a review JSON and post it:

\`\`\`bash
cat > /tmp/pr-review.json << 'REVIEW_EOF'
{
  "body": "## AI PR Review Summary\\n\\n**Verdict:** [APPROVE | REQUEST_CHANGES]\\n\\n### Overview\\n[summary]\\n\\n### Blocking Issues\\n[list or 'None']\\n\\n### Nits & Suggestions\\n[list or 'None']",
  "event": "APPROVE or REQUEST_CHANGES",
  "comments": [
    {
      "path": "file.ts",
      "line": 42,
      "side": "RIGHT",
      "body": "**Bug:** description\\n\\n\\\`\\\`\\\`suggestion\\nfix here\\n\\\`\\\`\\\`"
    }
  ]
}
REVIEW_EOF

gh api repos/${repoSlug}/pulls/${prNumber}/reviews \\
  --method POST \\
  --input /tmp/pr-review.json

rm -f /tmp/pr-review.json
\`\`\`

## Step 4: Report your verdict

After posting the review, update the task based on your verdict:

### If APPROVED (no blocking issues):

\`\`\`bash
curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "${config.auto_advance_on_approve ? 'done' : 'review'}", "completion_notes": "AI review passed (round ${reviewRounds + 1})", "review_rounds": ${reviewRounds + 1}}'
\`\`\`

### If REQUEST_CHANGES (blocking issues found):

\`\`\`bash
curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "review_rejected", "completion_notes": "AI review requested changes (round ${reviewRounds + 1}): <SUMMARY_OF_ISSUES>", "review_rounds": ${reviewRounds + 1}}'
\`\`\`

Replace \`<SUMMARY_OF_ISSUES>\` with a brief summary of the blocking issues.

## Rules

- Use the \`event\` field "APPROVE" or "REQUEST_CHANGES" (not "COMMENT")
- Only use REQUEST_CHANGES for actual bugs, security issues, or broken functionality
- Style nits alone should NOT block — use APPROVE with nit comments
- Be constructive — suggest fixes, don't just criticize
- Post inline comments on specific lines when possible
- Clean up temp files after posting
`;
}

function buildFixReviewPrompt(task: Task, project: TaskList | null): string {
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const memoryPath = join(workDir, '.memory', 'context.md');
  const claudeMdPath = join(workDir, 'CLAUDE.md');
  const repoSlug = parseRepoSlug(project?.repository_url ?? null);
  const prNumber = parsePrNumber(task.pr_url);
  const branchName = task.branch_name || generateBranchName(task);

  return [
    `Project: ${project?.name || 'Unknown'}`,
    existsSync(claudeMdPath) ? `Read ${claudeMdPath} for project rules.` : '',
    existsSync(memoryPath) ? `Read ${memoryPath} for current context.` : '',
    '',
    `Task: Fix review feedback for "${task.title}"`,
    '',
    '## Context',
    `This task was reviewed by the AI reviewer and changes were requested.`,
    task.completion_notes ? `**Review feedback:** ${task.completion_notes}` : '',
    '',
    '## Step 1: Read the PR review comments',
    '',
    repoSlug && prNumber ? `\`\`\`bash
# Get review comments
gh pr view ${prNumber} --repo ${repoSlug} --json reviews --jq '.reviews[-1].body'

# Get inline review comments
gh api repos/${repoSlug}/pulls/${prNumber}/comments --jq '.[] | "\\(.path):\\(.line) — \\(.body)"'
\`\`\`` : 'PR URL not available — check task.completion_notes for feedback.',
    '',
    '## Step 2: Fix the issues',
    '',
    `Checkout the existing branch and fix the issues raised in the review:`,
    '',
    `\`\`\`bash`,
    `git checkout ${branchName}`,
    `git pull origin ${branchName}`,
    `\`\`\``,
    '',
    'Make the necessary fixes based on the review feedback.',
    '',
    '## Step 3: Push the fixes',
    '',
    `\`\`\`bash`,
    `git add -A`,
    `git commit -m "fix: address review feedback for ${task.title.replace(/"/g, '\\"')}"`,
    `git push origin ${branchName}`,
    `\`\`\``,
    '',
    'Do NOT create a new PR — push to the existing branch.',
    '',
    '## Step 4: Update the task',
    '',
    `After pushing fixes, move the task back to ai_review:`,
    '',
    `\`\`\`bash`,
    `curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\`,
    `  -H "Authorization: Bearer $KANBAN_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"status": "ai_review", "completion_notes": "Fixes pushed for re-review"}'`,
    `\`\`\``,
    '',
    'When done, update .memory/context.md with what you accomplished.',
    '',
    '## Post Summary Comment',
    '',
    'After pushing fixes, post a summary comment:',
    '',
    '```bash',
    `curl -s -X POST "$KANBAN_API_URL/api/tasks/${task.id}/comments" \\`,
    '  -H "Authorization: Bearer $KANBAN_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"author":"orchestrator","author_type":"bot","content":"<SUMMARY>","comment_type":"summary"}\'',
    '```',
  ].filter(Boolean).join('\n');
}

async function startAiReviewSession(projectId: string, task: Task, config: { max_review_rounds: number; auto_advance_on_approve: boolean }): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping AI review', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project, skipping AI review', { projectId });
    return;
  }

  const reviewRounds = task.review_rounds || 0;
  if (reviewRounds >= config.max_review_rounds) {
    log('WARN', 'Task exceeded max review rounds, escalating to human review', {
      taskId: task.id, reviewRounds, maxRounds: config.max_review_rounds,
    });
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        status: 'review',
        completion_notes: `Escalated to human review after ${reviewRounds} AI review rounds`,
      });
    } catch (e) {
      log('ERROR', 'Failed to escalate task to human review', { error: String(e) });
    }
    return;
  }

  if (!task.pr_url) {
    log('WARN', 'Task has no PR URL, cannot run AI review', { taskId: task.id });
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        status: 'review',
        completion_notes: 'Moved to human review: no PR URL for AI review',
      });
    } catch (e) {
      log('ERROR', 'Failed to move task to review', { error: String(e) });
    }
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const systemPrompt = buildAiReviewPrompt(task, project, config);

  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `AI Review: ${task.title}`,
  });

  const sessionId = session.id;

  log('INFO', 'Starting AI review session', {
    sessionId, projectId, taskId: task.id, taskTitle: task.title, reviewRound: reviewRounds + 1,
  });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Starting AI review (round ${reviewRounds + 1}): ${task.title}`,
    metadata: { session_type: 'ai_review' },
  });

  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
      GH_TOKEN: GH_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  claude.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);
    const success = code === 0;

    log(success ? 'INFO' : 'ERROR', 'AI review session ended', {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    // Save Claude session ID for future resumption
    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: success ? 'completed' : 'error',
        summary: success
          ? `AI Review completed: ${task.title}`
          : `AI Review failed (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update AI review session', { error: String(e) });
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `AI Review completed: ${task.title}`
          : `AI Review failed (exit ${code}): ${stderr.slice(-200)}`,
        metadata: { session_type: 'ai_review' },
      });
    } catch (e) {
      log('ERROR', 'Failed to report AI review session end', { error: String(e) });
    }

    // On failure, move to human review as fallback
    if (!success) {
      try {
        await apiPatch(`/api/tasks/${task.id}`, {
          status: 'review',
          completion_notes: `AI review session failed (exit ${code}), escalated to human review`,
        });
      } catch (e) {
        log('ERROR', 'Failed to escalate task after AI review failure', { error: String(e) });
      }
    }
    // On success, the prompt instructs Claude to update the task status

    // Post bot comment with review result
    const reviewComment = success
      ? `AI review session completed for "${task.title}".`
      : `AI review session failed (exit ${code}). Escalated to human review.`;
    await postBotComment(task.id, reviewComment, success ? 'summary' : 'error');
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn AI review Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

async function startFixReviewSession(projectId: string, task: Task): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping fix review', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project, skipping fix review', { projectId });
    return;
  }

  if (task.error_count >= MAX_RETRIES) {
    log('WARN', 'Review-rejected task exceeded retry limit, escalating', { taskId: task.id, errorCount: task.error_count });
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        status: 'review',
        completion_notes: `Escalated to human review after ${task.error_count} fix attempts`,
      });
    } catch (e) {
      log('ERROR', 'Failed to escalate task', { error: String(e) });
    }
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const systemPrompt = buildFixReviewPrompt(task, project);

  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Fixing review feedback: ${task.title}`,
  });

  const sessionId = session.id;

  log('INFO', 'Starting fix review session', {
    sessionId, projectId, taskId: task.id, taskTitle: task.title,
  });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Fixing review feedback: ${task.title}`,
    metadata: { session_type: 'fix_review' },
  });

  // Move task to in_progress while fixing
  try {
    await apiPatch(`/api/tasks/${task.id}`, { status: 'in_progress', assigned_to: 'orchestrator' });
  } catch (e) {
    log('WARN', 'Failed to claim review_rejected task', { taskId: task.id });
  }

  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
      GH_TOKEN: GH_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  claude.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);
    const success = code === 0;

    log(success ? 'INFO' : 'ERROR', 'Fix review session ended', {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    // Save Claude session ID for future resumption
    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: success ? 'completed' : 'error',
        summary: success
          ? `Fixed review feedback: ${task.title}`
          : `Fix review failed (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update fix review session', { error: String(e) });
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `Fixed review feedback: ${task.title}`
          : `Fix review failed (exit ${code}): ${stderr.slice(-200)}`,
        metadata: { session_type: 'fix_review' },
      });
    } catch (e) {
      log('ERROR', 'Failed to report fix review session end', { error: String(e) });
    }

    // On failure, increment error count and move back to review_rejected
    if (!success) {
      try {
        await apiPatch(`/api/tasks/${task.id}`, {
          status: 'review_rejected',
          error_count: task.error_count + 1,
          assigned_to: null,
        });
      } catch (e) {
        log('ERROR', 'Failed to update task after fix review failure', { error: String(e) });
      }
    }
    // On success, the prompt instructs Claude to move task to ai_review

    // Post bot comment with fix review result
    const fixComment = success
      ? `Fix review session completed. Fixes pushed for re-review.`
      : `Fix review session failed (exit ${code}). Error count: ${task.error_count + 1}.`;
    await postBotComment(task.id, fixComment, success ? 'summary' : 'error');
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn fix review Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

// ── Local testing sessions ───────────────────────────────────────────

function buildTestingPrompt(task: Task, project: TaskList | null, config: { auto_advance_on_pass: boolean }, aiReviewEnabled: boolean): string {
  const nextStatusOnPass = aiReviewEnabled ? 'ai_review' : 'review';

  return `You are an automated browser testing agent. Your job is to test the feature described in this task using the Playwright MCP tools.

## Task Under Test

**Task ID:** ${task.id}
**Title:** ${task.title}
**Branch:** ${task.branch_name || '(none)'}
**PR:** ${task.pr_url || '(none)'}

**Description:**
${task.description || '(no description)'}

## Step 1: Read task history for context

\`\`\`bash
curl -s "$KANBAN_API_URL/api/tasks/${task.id}/comments?limit=20" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" | head -c 3000
\`\`\`

## Step 2: Run browser tests using Playwright MCP

Use the Playwright MCP tools (mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, etc.) to:

1. Navigate to the running local app (typically http://localhost:3000) or a PR deployment URL from the task PR
2. Test the specific feature described in the task title and description
3. Verify the core acceptance criteria are met
4. Take a screenshot on failure using mcp__playwright__browser_take_screenshot

Test the happy path and at least one edge case. Be thorough but focused on the task's scope.

## Step 3: Post your verdict

### If PASS (feature works as expected):

Post a [TEST PASS] comment:

\`\`\`bash
curl -s -X POST "$KANBAN_API_URL/api/tasks/${task.id}/comments" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"author":"orchestrator","author_type":"bot","content":"[TEST PASS] <SUMMARY_OF_WHAT_WAS_TESTED_AND_PASSED>","comment_type":"summary"}'
\`\`\`

Then move the task to ${nextStatusOnPass}:

\`\`\`bash
curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"${nextStatusOnPass}","completion_notes":"Tests passed: <BRIEF_SUMMARY>"}'
\`\`\`

### If FAIL (feature is broken or incomplete):

Post a detailed [TEST FAIL] comment with what was tested, what failed, and steps to reproduce:

\`\`\`bash
curl -s -X POST "$KANBAN_API_URL/api/tasks/${task.id}/comments" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"author":"orchestrator","author_type":"bot","content":"[TEST FAIL] ## What was tested\\n<DESCRIPTION>\\n\\n## What failed\\n<FAILURE_DESCRIPTION>\\n\\n## Steps to reproduce\\n<STEPS>\\n\\n## Screenshots\\n<SCREENSHOT_PATHS_OR_DESCRIPTIONS>","comment_type":"error"}'
\`\`\`

Then move the task to test_failed:

\`\`\`bash
curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"test_failed","completion_notes":"Tests failed: <BRIEF_SUMMARY>"}'
\`\`\`

## Rules

- Do NOT fix any code — your job is to test and document, not to develop
- Do NOT create branches, commits, or PRs
- Always post either a [TEST PASS] or [TEST FAIL] comment before updating the task status
- If the app is not running or you cannot connect, mark as FAIL with a clear explanation
- Be specific in failure reports — the developer needs enough detail to reproduce and fix the issue
`;
}

function buildFixTestFailurePrompt(task: Task, project: TaskList | null): string {
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const memoryPath = join(workDir, '.memory', 'context.md');
  const claudeMdPath = join(workDir, 'CLAUDE.md');
  const branchName = task.branch_name || generateBranchName(task);

  return [
    `Project: ${project?.name || 'Unknown'}`,
    existsSync(claudeMdPath) ? `Read ${claudeMdPath} for project rules.` : '',
    existsSync(memoryPath) ? `Read ${memoryPath} for current context.` : '',
    '',
    `Task: Fix test failures for "${task.title}"`,
    '',
    '## Context',
    `This task failed automated browser testing. Read the test failure report and fix the bugs.`,
    task.completion_notes ? `**Test failure summary:** ${task.completion_notes}` : '',
    '',
    '## Step 1: Read the test failure report',
    '',
    `\`\`\`bash
# Get the latest [TEST FAIL] comment
curl -s "$KANBAN_API_URL/api/tasks/${task.id}/comments?limit=20" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" | head -c 5000
\`\`\``,
    '',
    '## Step 2: Fix the issues',
    '',
    `Checkout the existing branch and fix the bugs described in the test failure report:`,
    '',
    '```bash',
    `git checkout ${branchName}`,
    `git pull origin ${branchName}`,
    '```',
    '',
    'Make the necessary fixes based on the test failure report.',
    '',
    '## Step 3: Push the fixes',
    '',
    '```bash',
    'git add -A',
    `git commit -m "fix: address test failures for ${task.title.replace(/"/g, '\\"')}"`,
    `git push origin ${branchName}`,
    '```',
    '',
    'Do NOT create a new branch or PR — push to the existing branch.',
    '',
    '## Step 4: Update the task',
    '',
    'After pushing fixes, move the task to testing for re-test:',
    '',
    '```bash',
    `curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\`,
    `  -H "Authorization: Bearer $KANBAN_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"status":"testing","completion_notes":"Fixes pushed for re-test"}'`,
    '```',
    '',
    'When done, update .memory/context.md with what you accomplished.',
    '',
    '## Post Summary Comment',
    '',
    '```bash',
    `curl -s -X POST "$KANBAN_API_URL/api/tasks/${task.id}/comments" \\`,
    '  -H "Authorization: Bearer $KANBAN_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"author":"orchestrator","author_type":"bot","content":"<SUMMARY>","comment_type":"summary"}\'',
    '```',
  ].filter(Boolean).join('\n');
}

async function startTestingSession(projectId: string, task: Task, config: { auto_advance_on_pass: boolean }, aiReviewEnabled: boolean): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping testing session', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project, skipping testing session', { projectId });
    return;
  }

  if (!task.pr_url) {
    log('WARN', 'Task has no PR URL, skipping testing session and moving to review', { taskId: task.id });
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        status: aiReviewEnabled ? 'ai_review' : 'review',
        completion_notes: 'Skipped local testing: no PR URL',
      });
    } catch (e) {
      log('ERROR', 'Failed to move task past testing', { error: String(e) });
    }
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const systemPrompt = buildTestingPrompt(task, project, config, aiReviewEnabled);

  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Testing: ${task.title}`,
  });

  const sessionId = session.id;

  log('INFO', 'Starting testing session', {
    sessionId, projectId, taskId: task.id, taskTitle: task.title,
  });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Starting browser tests: ${task.title}`,
    metadata: { session_type: 'local_testing' },
  });

  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
      GH_TOKEN: GH_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  claude.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);
    const success = code === 0;

    log(success ? 'INFO' : 'ERROR', 'Testing session ended', {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: success ? 'completed' : 'error',
        summary: success
          ? `Tests completed: ${task.title}`
          : `Testing failed (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update testing session', { error: String(e) });
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `Tests completed: ${task.title}`
          : `Testing failed (exit ${code}): ${stderr.slice(-200)}`,
        metadata: { session_type: 'local_testing' },
      });
    } catch (e) {
      log('ERROR', 'Failed to report testing session end', { error: String(e) });
    }

    // On process crash (not a test failure — the prompt handles pass/fail status updates),
    // fall back to moving the task to review so it isn't stuck
    if (!success) {
      try {
        await apiPatch(`/api/tasks/${task.id}`, {
          status: aiReviewEnabled ? 'ai_review' : 'review',
          completion_notes: `Testing session crashed (exit ${code}), escalated past testing`,
        });
      } catch (e) {
        log('ERROR', 'Failed to escalate task after testing session crash', { error: String(e) });
      }
      await postBotComment(
        task.id,
        `Testing session crashed (exit ${code}). Task moved to ${aiReviewEnabled ? 'ai_review' : 'review'}.`,
        'error'
      );
    }
    // On success, the prompt instructs Claude to update task status based on test results
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn testing Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

async function startFixTestFailureSession(projectId: string, task: Task): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping fix test failure session', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project, skipping fix test failure session', { projectId });
    return;
  }

  if (task.error_count >= MAX_RETRIES) {
    log('WARN', 'Test-failed task exceeded retry limit, escalating', { taskId: task.id, errorCount: task.error_count });
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        status: 'review',
        completion_notes: `Escalated to human review after ${task.error_count} fix attempts`,
      });
    } catch (e) {
      log('ERROR', 'Failed to escalate test_failed task', { error: String(e) });
    }
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const systemPrompt = buildFixTestFailurePrompt(task, project);

  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Fixing test failures: ${task.title}`,
  });

  const sessionId = session.id;

  log('INFO', 'Starting fix test failure session', {
    sessionId, projectId, taskId: task.id, taskTitle: task.title,
  });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Fixing test failures: ${task.title}`,
    metadata: { session_type: 'fix_test_failure' },
  });

  // Move task to in_progress while fixing
  try {
    await apiPatch(`/api/tasks/${task.id}`, { status: 'in_progress', assigned_to: 'orchestrator' });
  } catch (e) {
    log('WARN', 'Failed to claim test_failed task', { taskId: task.id });
  }

  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
      GH_TOKEN: GH_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  claude.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);
    const success = code === 0;

    log(success ? 'INFO' : 'ERROR', 'Fix test failure session ended', {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: success ? 'completed' : 'error',
        summary: success
          ? `Fixed test failures: ${task.title}`
          : `Fix test failure failed (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update fix test failure session', { error: String(e) });
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `Fixed test failures: ${task.title}`
          : `Fix test failure failed (exit ${code}): ${stderr.slice(-200)}`,
        metadata: { session_type: 'fix_test_failure' },
      });
    } catch (e) {
      log('ERROR', 'Failed to report fix test failure session end', { error: String(e) });
    }

    // On failure, increment error count and move back to test_failed
    if (!success) {
      try {
        await apiPatch(`/api/tasks/${task.id}`, {
          status: 'test_failed',
          error_count: task.error_count + 1,
          assigned_to: null,
        });
      } catch (e) {
        log('ERROR', 'Failed to update task after fix test failure', { error: String(e) });
      }
    }
    // On success, the prompt instructs Claude to move task to testing

    const fixComment = success
      ? `Fix test failure session completed. Fixes pushed for re-test.`
      : `Fix test failure session failed (exit ${code}). Error count: ${task.error_count + 1}.`;
    await postBotComment(task.id, fixComment, success ? 'summary' : 'error');
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn fix test failure Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

// ── Refinement sessions ──────────────────────────────────────────────

function buildRefinementPrompt(task: Task, project: TaskList | null, config: { auto_advance: boolean }): string {
  return `You are a task refinement assistant. Your ONLY job is to improve the title and description of a task on the kanban board. You must NOT write any code, create files, or make any changes to the codebase.

## Task to Refine

**ID:** ${task.id}
**Current Title:** ${task.title}
**Current Description:**
${task.description || '(no description)'}

## Your Goal

Analyze this task and produce a refined version with:
1. A clear, concise, actionable title (imperative mood, e.g. "Add user authentication" not "User authentication")
2. A well-structured description with:
   - **Overview**: 1-2 sentences explaining what this task accomplishes and why
   - **Deliverables**: Specific, checkable items (use markdown checkboxes)
   - **Technical Notes**: Implementation hints, relevant files, constraints, or dependencies
   - **Acceptance Criteria**: How to verify the task is done correctly

## How to Update the Task

Use curl to update the task via the API:

\`\`\`bash
curl -s -X PATCH "$KANBAN_API_URL/api/tasks/${task.id}" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Refined title here",
    "description": "Refined description here (use \\n for newlines)",
    "labels": ${JSON.stringify([...(Array.isArray(task.labels) ? task.labels : []), 'refined'])}${config.auto_advance ? ',\n    "status": "todo"' : ''}
  }'
\`\`\`

## Rules

- Do NOT create any files or modify any code
- Do NOT run git commands
- Do NOT create branches or PRs
- ONLY use curl to update the task via the API
- Keep the title under 80 characters
- Use markdown formatting in the description
- Preserve any existing technical details from the original description

## Report Completion

After updating the task, report completion:

\`\`\`bash
curl -s -X POST "$KANBAN_API_URL/api/events" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"event_type": "session_end", "session_id": "$KANBAN_SESSION_ID", "task_id": "${task.id}", "message": "Task refined: ${task.title.replace(/"/g, '\\"')}"}'
\`\`\`
`;
}

async function startRefinementSession(projectId: string, task: Task, config: { auto_advance: boolean }): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping refinement', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project, skipping refinement', { projectId });
    return;
  }

  // Check retry limit
  if (task.error_count >= MAX_RETRIES) {
    log('WARN', 'Refinement task exceeded retry limit, skipping', { taskId: task.id, errorCount: task.error_count });
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        status: 'todo',
        completion_notes: `Refinement failed after ${task.error_count} attempts, moved to todo`,
      });
    } catch (e) {
      log('ERROR', 'Failed to move refinement task to todo', { error: String(e) });
    }
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const systemPrompt = buildRefinementPrompt(task, project, config);

  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Refining: ${task.title}`,
  });

  const sessionId = session.id;

  log('INFO', 'Starting refinement session', {
    sessionId, projectId, taskId: task.id, taskTitle: task.title,
  });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Starting refinement: ${task.title}`,
    metadata: { session_type: 'refinement' },
  });

  // Spawn Claude with restricted permissions — no GH_TOKEN, only API access
  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  claude.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);
    const success = code === 0;

    log(success ? 'INFO' : 'ERROR', 'Refinement session ended', {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    // Save Claude session ID for future resumption
    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: success ? 'completed' : 'error',
        summary: success
          ? `Refined: ${task.title}`
          : `Refinement failed (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update refinement session', { error: String(e) });
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `Refined: ${task.title}`
          : `Refinement failed (exit ${code}): ${stderr.slice(-200)}`,
        metadata: { session_type: 'refinement' },
      });
    } catch (e) {
      log('ERROR', 'Failed to report refinement session end', { error: String(e) });
    }

    // On failure, increment error count but leave in refinement status
    if (!success) {
      try {
        await apiPatch(`/api/tasks/${task.id}`, {
          error_count: task.error_count + 1,
        });
      } catch (e) {
        log('ERROR', 'Failed to update task after refinement failure', { error: String(e) });
      }
    }
    // On success, the prompt instructs Claude to update the task status
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn refinement Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

// ── Stuck session detection ─────────────────────────────────────────

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function checkStuckSessions(): Promise<void> {
  const now = Date.now();

  for (const [projectId, entry] of activeSessions) {
    const ageMins = Math.round((now - entry.startedAt) / 60000);
    const pid = entry.process.pid;
    const timedOut = (now - entry.startedAt) >= SESSION_TIMEOUT_MS;
    const dead = pid != null && !isProcessAlive(pid);

    if (!timedOut && !dead) continue;

    const reason = dead ? 'dead process' : 'timeout';
    log('WARN', 'Killing stuck session', {
      sessionId: entry.sessionId, taskId: entry.taskId, projectId, reason, ageMinutes: ageMins,
    });

    // Kill the process (SIGTERM, then SIGKILL after 5s)
    if (pid != null && !dead) {
      entry.process.kill('SIGTERM');
      setTimeout(() => {
        if (isProcessAlive(pid)) {
          entry.process.kill('SIGKILL');
        }
      }, 5000);
    }

    activeSessions.delete(projectId);

    // Update session status to error
    try {
      await apiPatch(`/api/sessions/${entry.sessionId}`, {
        status: 'error',
        summary: `Session killed: ${reason} after ${ageMins} minutes`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update stuck session', { error: String(e) });
    }

    // Reset task to todo with incremented error_count
    try {
      const { task } = await apiGet<{ task: Task }>(`/api/tasks/${entry.taskId}`);
      await apiPatch(`/api/tasks/${entry.taskId}`, {
        status: 'todo',
        assigned_to: null,
        error_count: (task.error_count || 0) + 1,
      });
    } catch (e) {
      log('ERROR', 'Failed to reset stuck task', { error: String(e) });
    }

    // Post error event
    try {
      await apiPost('/api/events', {
        event_type: 'session_error',
        session_id: entry.sessionId,
        task_id: entry.taskId,
        message: `Session killed: ${reason} after ${ageMins} minutes. Task reset to todo.`,
      });
    } catch (e) {
      log('ERROR', 'Failed to post stuck session event', { error: String(e) });
    }
  }
}

// ── Message sessions (async chat) ───────────────────────────────────

interface TaskComment {
  id: string;
  task_id: string;
  author: string;
  author_type: string;
  content: string;
  comment_type: string;
  created_at: string;
}

async function getPendingMessageTasks(): Promise<Task[]> {
  try {
    const { tasks } = await apiGet<{ tasks: Task[] }>('/api/tasks/pending-messages');
    return tasks;
  } catch (e) {
    log('WARN', 'Failed to fetch pending message tasks', { error: String(e) });
    return [];
  }
}

function buildMessageSessionPrompt(task: Task, project: TaskList | null, comments: TaskComment[]): string {
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const claudeMdPath = join(workDir, 'CLAUDE.md');
  const memoryPath = join(workDir, '.memory', 'context.md');

  // Format comment history as a chat log
  const chatLog = comments
    .map(c => `[${c.created_at}] ${c.author} (${c.author_type}): ${c.content}`)
    .join('\n');

  // Find the latest human message
  const latestUserComment = [...comments].reverse().find(c => c.author_type === 'user');

  return [
    `Project: ${project?.name || 'Unknown'}`,
    existsSync(claudeMdPath) ? `Read ${claudeMdPath} for project rules.` : '',
    existsSync(memoryPath) ? `Read ${memoryPath} for current context.` : '',
    '',
    `## Task: ${task.title}`,
    task.description || '',
    '',
    `**Status:** ${task.status}`,
    task.branch_name ? `**Branch:** ${task.branch_name}` : '',
    task.pr_url ? `**PR:** ${task.pr_url}` : '',
    '',
    '## Comment History',
    '',
    chatLog || '(no previous comments)',
    '',
    '## Current Request',
    '',
    latestUserComment ? latestUserComment.content : '(no message found)',
    '',
    '## Instructions',
    '',
    'A human has sent a message on this task. You have full access to the codebase.',
    '- If the user asks a question, respond via comment.',
    '- If they ask for an action (code changes, investigation, etc.), do it and comment back with results.',
    '- If you make code changes, commit and push to the existing branch if one exists.',
    '',
    'When done, post your response as a comment:',
    '',
    '```bash',
    `curl -s -X POST "$KANBAN_API_URL/api/tasks/${task.id}/comments" \\`,
    '  -H "Authorization: Bearer $KANBAN_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"author":"orchestrator","author_type":"bot","content":"<YOUR_RESPONSE>","comment_type":"summary"}\'',
    '```',
    '',
    'Replace <YOUR_RESPONSE> with your actual response to the user.',
  ].filter(Boolean).join('\n');
}

async function startMessageSession(projectId: string, task: Task): Promise<void> {
  if (activeSessions.size >= MAX_CONCURRENT) {
    log('WARN', 'Concurrency limit reached, skipping message session', { projectId, maxConcurrent: MAX_CONCURRENT });
    return;
  }

  if (activeSessions.has(projectId)) {
    log('INFO', 'Session already active for project, skipping message session', { projectId });
    return;
  }

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;

  // Fetch comments for context
  let comments: TaskComment[] = [];
  try {
    const { comments: fetchedComments } = await apiGet<{ comments: TaskComment[] }>(
      `/api/tasks/${task.id}/comments?limit=50`
    );
    // Reverse to get chronological order (API returns newest first)
    comments = fetchedComments.reverse();
  } catch (e) {
    log('WARN', 'Failed to fetch task comments for message session', { error: String(e) });
  }

  const systemPrompt = buildMessageSessionPrompt(task, project, comments);

  // Register session with API
  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Responding to message on: ${task.title}`,
  });

  const sessionId = session.id;

  log('INFO', 'Starting message session', {
    sessionId, projectId, taskId: task.id, taskTitle: task.title,
  });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Responding to user message on: ${task.title}`,
    metadata: { session_type: 'message' },
  });

  // Use --resume if we have a claude_session_id (full AI memory of previous work)
  const claudeArgs = buildClaudeArgs(task, systemPrompt);
  const claude = spawn('claude', claudeArgs, {
    cwd: workDir,
    env: {
      ...CLEAN_ENV,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
      GH_TOKEN: GH_TOKEN,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id, startedAt: Date.now() });

  let stdout = '';
  let stderr = '';

  claude.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
  claude.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

  claude.on('close', async (code) => {
    activeSessions.delete(projectId);
    const success = code === 0;

    log(success ? 'INFO' : 'ERROR', 'Message session ended', {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

    // Save Claude session ID for future resumption
    if (success) {
      await saveClaudeSessionId(task, stdout);
    }

    try {
      await apiPatch(`/api/sessions/${sessionId}`, {
        status: success ? 'completed' : 'error',
        summary: success
          ? `Responded to message on: ${task.title}`
          : `Message session failed (exit ${code}): ${stderr.slice(-500)}`,
      });
    } catch (e) {
      log('ERROR', 'Failed to update message session', { error: String(e) });
    }

    try {
      await apiPost('/api/events', {
        event_type: 'session_end',
        session_id: sessionId,
        task_id: task.id,
        message: success
          ? `Responded to message on: ${task.title}`
          : `Message session failed (exit ${code}): ${stderr.slice(-200)}`,
        metadata: { session_type: 'message' },
      });
    } catch (e) {
      log('ERROR', 'Failed to report message session end', { error: String(e) });
    }

    // On failure, post an error comment so the user knows
    if (!success) {
      await postBotComment(
        task.id,
        `Failed to process your message (session error, exit ${code}). Please try again or check with a human.`,
        'error'
      );
    }
    // On success, the prompt instructs Claude to post a response comment
    // Do NOT change task status — message sessions don't modify workflow state
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn message session Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

// ── Main loop ───────────────────────────────────────────────────────

function sortByPriority(tasks: Task[]): Task[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return tasks.sort((a, b) =>
    (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) -
    (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
  );
}

async function pollCycle() {
  log('INFO', `Poll cycle starting (${activeSessions.size}/${MAX_CONCURRENT} active sessions)`);

  try {
    // Check for stuck or dead sessions before doing anything else
    await checkStuckSessions();

    // Initialize any new projects (clone repos) before processing tasks
    await initializeProjects();

    // Fetch feature toggles
    const toggles = await getFeatureToggles();
    const aiReviewEnabled = isAiReviewEnabled(toggles);
    const aiReviewConfig = aiReviewEnabled ? getAiReviewConfig(toggles) : null;
    const refinementEnabled = isRefinementEnabled(toggles);
    const localTestingEnabled = isLocalTestingEnabled(toggles);
    const localTestingConfig = localTestingEnabled ? getLocalTestingConfig(toggles) : null;

    const activeProjectIds = await getActiveSessions();

    // Also add locally tracked sessions
    for (const projectId of activeSessions.keys()) {
      activeProjectIds.add(projectId);
    }

    let started = 0;

    // Priority 0 (highest): Process pending user messages (async chat)
    const pendingMessages = await getPendingMessageTasks();
    for (const task of pendingMessages) {
      const projectId = task.task_list_id || 'default';
      if (activeProjectIds.has(projectId)) continue;
      if (activeSessions.size >= MAX_CONCURRENT) break;

      try {
        await startMessageSession(projectId, task);
        started++;
        activeProjectIds.add(projectId);
      } catch (e) {
        log('ERROR', 'Failed to start message session', { taskId: task.id, error: String(e) });
      }
    }

    // Priority 1: Process review_rejected tasks (fix for re-review)
    if (aiReviewEnabled) {
      const rejectedTasks = await getTasksByStatus('review_rejected');
      for (const [projectId, tasks] of rejectedTasks) {
        if (activeProjectIds.has(projectId)) continue;
        if (activeSessions.size >= MAX_CONCURRENT) break;

        const task = sortByPriority(tasks)[0];
        try {
          await startFixReviewSession(projectId, task);
          started++;
          activeProjectIds.add(projectId);
        } catch (e) {
          log('ERROR', 'Failed to start fix review session', { projectId, taskId: task.id, error: String(e) });
        }
      }
    }

    // Priority 2: Process test_failed tasks (fix for re-test)
    if (localTestingEnabled) {
      const testFailedTasks = await getTasksByStatus('test_failed');
      for (const [projectId, tasks] of testFailedTasks) {
        if (activeProjectIds.has(projectId)) continue;
        if (activeSessions.size >= MAX_CONCURRENT) break;

        const task = sortByPriority(tasks)[0];
        try {
          await startFixTestFailureSession(projectId, task);
          started++;
          activeProjectIds.add(projectId);
        } catch (e) {
          log('ERROR', 'Failed to start fix test failure session', { projectId, taskId: task.id, error: String(e) });
        }
      }
    }

    // Priority 3: Process ai_review tasks
    if (aiReviewEnabled && aiReviewConfig) {
      const aiReviewTasks = await getTasksByStatus('ai_review');
      for (const [projectId, tasks] of aiReviewTasks) {
        if (activeProjectIds.has(projectId)) continue;
        if (activeSessions.size >= MAX_CONCURRENT) break;

        const task = sortByPriority(tasks)[0];
        try {
          await startAiReviewSession(projectId, task, aiReviewConfig);
          started++;
          activeProjectIds.add(projectId);
        } catch (e) {
          log('ERROR', 'Failed to start AI review session', { projectId, taskId: task.id, error: String(e) });
        }
      }
    }

    // Priority 4: Process testing tasks (run browser tests)
    if (localTestingEnabled && localTestingConfig) {
      const testingTasks = await getTasksByStatus('testing');
      for (const [projectId, tasks] of testingTasks) {
        if (activeProjectIds.has(projectId)) continue;
        if (activeSessions.size >= MAX_CONCURRENT) break;

        const task = sortByPriority(tasks)[0];
        try {
          await startTestingSession(projectId, task, localTestingConfig, aiReviewEnabled);
          started++;
          activeProjectIds.add(projectId);
        } catch (e) {
          log('ERROR', 'Failed to start testing session', { projectId, taskId: task.id, error: String(e) });
        }
      }
    }

    // Priority 5: Process todo tasks
    const projectTasks = await getProjectTasks();
    for (const [projectId, tasks] of projectTasks) {
      if (activeProjectIds.has(projectId)) {
        log('INFO', 'Project already has active session, skipping', { projectId });
        continue;
      }

      if (activeSessions.size >= MAX_CONCURRENT) {
        log('INFO', 'Concurrency limit reached, waiting for next cycle');
        break;
      }

      // Try tasks in priority order — skip ones that hit retry limit
      const sorted = sortByPriority(tasks);
      let sessionStarted = false;
      for (const task of sorted) {
        if (task.error_count >= MAX_RETRIES) {
          log('INFO', 'Skipping task (retry limit), trying next', { taskId: task.id, errorCount: task.error_count });
          continue;
        }
        try {
          await startClaudeSession(projectId, task, { aiReviewEnabled, localTestingEnabled });
          started++;
          activeProjectIds.add(projectId);
          sessionStarted = true;
          break;
        } catch (e) {
          log('ERROR', 'Failed to start session', { projectId, taskId: task.id, error: String(e) });
        }
      }
      if (!sessionStarted && sorted.every(t => t.error_count >= MAX_RETRIES)) {
        log('WARN', 'All tasks in project exceeded retry limit', { projectId, taskCount: sorted.length });
      }
    }

    // Priority 6: Process refinement tasks (lowest priority)
    if (refinementEnabled) {
      const refinementConfig = getRefinementConfig(toggles);
      const refinementTasks = await getRefinementTasks();

      for (const [projectId, tasks] of refinementTasks) {
        if (activeProjectIds.has(projectId)) {
          log('INFO', 'Project already has active session, skipping refinement', { projectId });
          continue;
        }

        if (activeSessions.size >= MAX_CONCURRENT) {
          log('INFO', 'Concurrency limit reached, waiting for next cycle');
          break;
        }

        const task = sortByPriority(tasks)[0];
        try {
          await startRefinementSession(projectId, task, refinementConfig);
          started++;
          activeProjectIds.add(projectId);
        } catch (e) {
          log('ERROR', 'Failed to start refinement session', { projectId, taskId: task.id, error: String(e) });
        }
      }
    }

    log('INFO', `Poll cycle complete. Started ${started} new session(s), ${activeSessions.size} active`);
  } catch (e) {
    log('ERROR', 'Poll cycle failed', { error: String(e) });
  }
}

async function main() {
  log('INFO', `Orchestrator v${VERSION} starting`, {
    apiUrl: API_URL,
    pollInterval: POLL_INTERVAL,
    maxConcurrent: MAX_CONCURRENT,
    maxRetries: MAX_RETRIES,
    sessionTimeoutMs: SESSION_TIMEOUT_MS,
    projectsDir: PROJECTS_DIR,
  });

  if (!API_KEY) {
    log('ERROR', 'KANBAN_API_KEY not set. Set it and restart.');
    process.exit(1);
  }

  if (!GH_TOKEN) {
    log('WARN', 'GH_TOKEN not set. Agents will not be able to create GitHub PRs.');
  }

  // Initial poll
  await pollCycle();

  // Schedule recurring polls
  setInterval(pollCycle, POLL_INTERVAL);

  // Graceful shutdown
  const shutdown = () => {
    log('INFO', 'Shutting down orchestrator...');
    for (const [projectId, { process: proc }] of activeSessions) {
      log('INFO', `Killing Claude session for ${projectId}`);
      proc.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  log('ERROR', 'Orchestrator crashed', { error: String(e) });
  process.exit(1);
});
