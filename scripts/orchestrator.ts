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
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/workspace';
const TASKINFA_HOME = process.env.TASKINFA_HOME || '';
const PROJECTS_DIR = process.env.PROJECTS_DIR || join(WORKSPACE_ROOT, 'projects');
const GH_TOKEN = process.env.GH_TOKEN || '';
const LOG_DIR = TASKINFA_HOME ? join(TASKINFA_HOME, 'logs') : join(WORKSPACE_ROOT, '.memory');
const LOG_FILE = join(LOG_DIR, 'orchestrator.log');

// Track active Claude processes
const activeSessions = new Map<string, { process: ChildProcess; sessionId: string; taskId: string }>();

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

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API PATCH ${path} failed: ${res.status} ${await res.text()}`);
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
  error_count: number;
  pr_url: string | null;
  branch_name: string | null;
  labels: string[];
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
    const projectId = task.task_list_id || 'default';
    if (!grouped.has(projectId)) grouped.set(projectId, []);
    grouped.get(projectId)!.push(task);
  }

  return grouped;
}

async function getActiveSessions(): Promise<Set<string>> {
  const { sessions } = await apiGet<{ sessions: Session[] }>('/api/sessions?status=active');
  return new Set(sessions.map(s => s.project_id).filter(Boolean) as string[]);
}

async function getProjectInfo(projectId: string): Promise<TaskList | null> {
  try {
    const { task_list } = await apiGet<{ task_list: TaskList }>(`/api/task-lists/${projectId}`);
    return task_list;
  } catch {
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
  const { tasks } = await apiGet<{ tasks: (Task & { labels?: string[] | string })[] }>(
    '/api/tasks?status=refinement&limit=100'
  );
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    // Parse labels (API may return JSON string or array)
    const labels = Array.isArray(task.labels)
      ? task.labels
      : typeof task.labels === 'string'
        ? (() => { try { return JSON.parse(task.labels); } catch { return []; } })()
        : [];

    // Skip tasks that already have the 'refined' label
    if (labels.includes('refined')) {
      log('INFO', 'Skipping already refined task', { taskId: task.id, title: task.title });
      continue;
    }

    const projectId = task.task_list_id || 'default';
    if (!grouped.has(projectId)) grouped.set(projectId, []);
    grouped.get(projectId)!.push({ ...task, labels });
  }

  return grouped;
}

function generateBranchName(task: Task): string {
  const taskIdShort = task.id.replace('task_', '').slice(0, 8);
  const titleSlug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `task/${taskIdShort}/${titleSlug}`;
}

function buildSystemPrompt(task: Task, project: TaskList | null): string {
  const workDir = project?.working_directory || WORKSPACE_ROOT;
  const memoryPath = join(workDir, '.memory', 'context.md');
  const claudeMdPath = join(workDir, 'CLAUDE.md');
  const branchName = generateBranchName(task);

  const gitWorkflow = GH_TOKEN ? `
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
` : '';

  return [
    `Project: ${project?.name || 'Unknown'}`,
    existsSync(claudeMdPath) ? `Read ${claudeMdPath} for project rules.` : '',
    existsSync(memoryPath) ? `Read ${memoryPath} for current context.` : '',
    '',
    `Task: ${task.title}`,
    task.description || '',
    '',
    'Do the task. When done, update .memory/context.md with what you accomplished.',
    gitWorkflow,
  ].filter(Boolean).join('\n');
}

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
    "labels": ${JSON.stringify([...task.labels, 'refined'])}${config.auto_advance ? ',\n    "status": "todo"' : ''}
  }'
\`\`\`

## Rules

- Do NOT create any files or modify any code
- Do NOT create git branches or PRs
- ONLY update the task title, description, and labels via the API
- Add the "refined" label to indicate this task has been refined
${config.auto_advance ? '- Move the task to "todo" status after refinement' : '- Leave the task in "refinement" status after updating'}
- If the task already has a good description, still add the "refined" label${config.auto_advance ? ' and move to todo' : ''}
- Keep the description concise — avoid unnecessary padding or filler text
- Report completion via the events API when done

## Report Completion

After updating the task, report that refinement is complete:

\`\`\`bash
curl -s -X POST "$KANBAN_API_URL/api/events" \\
  -H "Authorization: Bearer $KANBAN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "task_completed",
    "session_id": "'$KANBAN_SESSION_ID'",
    "task_id": "${task.id}",
    "message": "Task refined: ${task.title.replace(/"/g, '\\"')}"
  }'
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

  const project = await getProjectInfo(projectId);
  const workDir = project?.working_directory || WORKSPACE_ROOT;

  const { session } = await apiPost<{ session: Session }>('/api/sessions', {
    project_id: projectId,
    current_task_id: task.id,
    status: 'active',
    summary: `Refining: ${task.title}`,
  });

  const sessionId = session.id;
  const systemPrompt = buildRefinementPrompt(task, project, config);

  log('INFO', 'Starting refinement session', { sessionId, projectId, taskId: task.id, taskTitle: task.title });

  await apiPost('/api/events', {
    event_type: 'session_start',
    session_id: sessionId,
    task_id: task.id,
    message: `Starting refinement: ${task.title}`,
    metadata: { session_type: 'refinement' },
  });

  // Spawn Claude with restricted permissions — no code tools, only bash for API calls
  const claude = spawn('claude', [
    '-p', systemPrompt,
    '--dangerously-skip-permissions',
    '--output-format', 'text',
  ], {
    cwd: workDir,
    env: {
      ...process.env,
      KANBAN_API_URL: API_URL,
      KANBAN_API_KEY: API_KEY,
      KANBAN_SESSION_ID: sessionId,
      KANBAN_TASK_ID: task.id,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  claude.stdin?.end();
  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id });

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
        log('ERROR', 'Failed to update task error count', { error: String(e) });
      }
    }
    // On success, the refinement prompt instructs Claude to update the task
    // (add 'refined' label and optionally move to 'todo')
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn refinement Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

async function startClaudeSession(projectId: string, task: Task): Promise<void> {
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
  const claude = spawn('claude', [
    '-p', systemPrompt,
    '--dangerously-skip-permissions',
    '--output-format', 'text',
  ], {
    cwd: workDir,
    env: {
      ...process.env,
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

  activeSessions.set(projectId, { process: claude, sessionId, taskId: task.id });

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
    const success = code === 0;
    const finalStatus = success ? 'completed' : 'error';

    log(success ? 'INFO' : 'ERROR', `Claude session ended`, {
      sessionId, projectId, taskId: task.id, exitCode: code,
    });

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
      if (success) {
        await apiPatch(`/api/tasks/${task.id}`, {
          status: 'review',
          completion_notes: stdout.slice(-1000),
        });
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
  });

  claude.on('error', (err) => {
    log('ERROR', 'Failed to spawn Claude process', { error: err.message, projectId });
    activeSessions.delete(projectId);
  });
}

// ── Main loop ───────────────────────────────────────────────────────

async function pollCycle() {
  log('INFO', `Poll cycle starting (${activeSessions.size}/${MAX_CONCURRENT} active sessions)`);

  try {
    // Initialize any new projects (clone repos) before processing tasks
    await initializeProjects();

    // Fetch feature toggles to check for refinement
    const toggles = await getFeatureToggles();
    const refinementEnabled = isRefinementEnabled(toggles);

    const projectTasks = await getProjectTasks();
    const activeProjectIds = await getActiveSessions();

    // Also add locally tracked sessions
    for (const projectId of activeSessions.keys()) {
      activeProjectIds.add(projectId);
    }

    let started = 0;

    // Priority 1: Process todo tasks (higher priority than refinement)
    for (const [projectId, tasks] of projectTasks) {
      if (activeProjectIds.has(projectId)) {
        log('INFO', 'Project already has active session, skipping', { projectId });
        continue;
      }

      if (activeSessions.size >= MAX_CONCURRENT) {
        log('INFO', 'Concurrency limit reached, waiting for next cycle');
        break;
      }

      // Pick highest priority task
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      tasks.sort((a, b) =>
        (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
      );

      const task = tasks[0];
      try {
        await startClaudeSession(projectId, task);
        started++;
        activeProjectIds.add(projectId);
      } catch (e) {
        log('ERROR', 'Failed to start session', { projectId, taskId: task.id, error: String(e) });
      }
    }

    // Priority 2: Process refinement tasks (lower priority than todo)
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

        // Pick highest priority refinement task
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        tasks.sort((a, b) =>
          (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
        );

        const task = tasks[0];
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
