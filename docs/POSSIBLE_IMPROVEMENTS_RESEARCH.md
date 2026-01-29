# Taskinfa-Kanban: Enterprise Improvement Research & Strategic Plan

**Date:** January 29, 2026
**Author:** Lead Architect Research
**Branch:** task/task_2RhdllXRZ_9LfBndKedUc
**Status:** Research Complete - Awaiting Prioritization

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Lessons from Clawdbot/Moltbot](#4-lessons-from-clawdbotmoltbot)
5. [Strategic Improvement Areas](#5-strategic-improvement-areas)
   - 5.1 [Multi-Workspace & Team Collaboration](#51-multi-workspace--team-collaboration)
   - 5.2 [Role-Based Access Control (RBAC)](#52-role-based-access-control-rbac)
   - 5.3 [Multi-Agent Orchestration](#53-multi-agent-orchestration)
   - 5.4 [Self-Evolving & Learning System](#54-self-evolving--learning-system)
   - 5.5 [Web UI Autonomy (No Terminal Required)](#55-web-ui-autonomy-no-terminal-required)
   - 5.6 [Task Intelligence & Automation](#56-task-intelligence--automation)
   - 5.7 [Security & Privacy Hardening](#57-security--privacy-hardening)
   - 5.8 [Integration Ecosystem](#58-integration-ecosystem)
   - 5.9 [Observability & Audit System](#59-observability--audit-system)
   - 5.10 [Enterprise Deployment Options](#510-enterprise-deployment-options)
6. [Architecture Evolution Plan](#6-architecture-evolution-plan)
7. [Database Schema Evolution](#7-database-schema-evolution)
8. [Implementation Phases](#8-implementation-phases)
9. [Risk Analysis](#9-risk-analysis)
10. [Research Sources](#10-research-sources)

---

## 1. Executive Summary

Taskinfa-Kanban is a production-ready autonomous task execution system with a solid foundation: monorepo architecture, Cloudflare Workers deployment, real-time SSE updates, MCP protocol integration, and a sophisticated bot execution loop with circuit breakers. However, to become the leading multi-agent, self-evolving project management tool, significant enhancements are needed across team collaboration, security, automation, and AI intelligence.

This document presents a comprehensive research-backed plan organized into 10 strategic improvement areas, with phased implementation recommendations. The goal is to reach enterprise-grade capabilities while maintaining the core value proposition: **AI agents and humans collaborating on big projects with full automation but maximum flexibility.**

**Key findings:**
- The PM tool market is bifurcating between developer-focused (Linear, Zenhub) and enterprise platforms (Jira/Rovo, Wrike). Taskinfa-Kanban can occupy a unique position as an **AI-native, privacy-first, self-hosted capable** PM tool.
- Multi-agent systems are the next frontier (market projected $7.8B to $52B+ by 2030). Our MCP-based architecture positions us well.
- Clawdbot/Moltbot's viral success (60k+ GitHub stars) and subsequent security failures provide critical lessons: **security must be first-class, not an afterthought**.
- Our server-side execution model on Cloudflare Workers is inherently more secure than Clawdbot's local-machine-with-root-access approach.
- Current gaps: no team collaboration, no RBAC, no task dependencies, no notifications, no audit trail, no self-service bot management from the web UI.

---

## 2. Current State Analysis

### What We Have (Strengths)

| Area | Current State | Assessment |
|------|--------------|------------|
| **Architecture** | Monorepo (dashboard, bot, shared) with Turborepo | Solid foundation |
| **Frontend** | Next.js 15 + React 19 + Tailwind CSS | Modern stack |
| **Backend** | Next.js API routes on Cloudflare Workers | Scalable, edge-native |
| **Database** | Cloudflare D1 (SQLite) with 5 migrations | Good for current scale |
| **Auth** | JWT sessions + API key auth (SHA-256 hashed) | Secure baseline |
| **Real-time** | SSE with 2-second polling | Functional, not optimal |
| **Bot Execution** | Claude Code CLI with MCP, circuit breakers | Sophisticated |
| **Task Management** | Kanban board with drag-and-drop, 5 status columns | Core feature works |
| **Worker Monitoring** | Health tracking, heartbeat, status badges | Basic but functional |
| **Deployment** | Cloudflare Workers + D1 + GitHub Actions CI/CD | Production-ready |

### What We Lack (Gaps)

| Area | Gap | Impact |
|------|-----|--------|
| **Team Collaboration** | 1:1 user-to-workspace, no team members | Cannot scale beyond solo use |
| **RBAC** | No roles or permissions beyond owner | No enterprise adoption |
| **Task Dependencies** | No blocking/blocked-by relationships | Cannot model complex projects |
| **Subtasks** | No parent-child task hierarchy | Cannot break down work |
| **Notifications** | No email, Slack, or webhook notifications | Users must poll the UI |
| **Audit Trail** | Only task comments, no structured audit log | Cannot meet compliance requirements |
| **Bot Management UI** | Bots managed via Docker CLI only | Requires terminal expertise |
| **Search** | No full-text search across tasks | Poor discoverability at scale |
| **Rate Limiting** | Commented out (in-memory doesn't work serverless) | Security vulnerability |
| **Testing** | Only 2 unit test files | Low confidence in changes |
| **Task Templates** | No reusable task templates | Repetitive manual creation |
| **Reporting** | No analytics or dashboards | No project visibility |
| **Multi-Project Views** | Basic task list selection | No portfolio-level view |

### Database Schema Assessment for Multi-Tenancy

Current schema supports workspace isolation but has critical limitations:

```
users (1) ──── (1) workspaces    # 1:1 mapping - blocks team collaboration
workspaces (1) ──── (N) tasks    # Good - workspace scoping works
workspaces (1) ──── (N) task_lists   # Good - project scoping works
workspaces (1) ──── (N) api_keys     # Good - key scoping works
workspaces (1) ──── (N) workers      # Good - worker scoping works
```

**Critical issue:** The `users.workspace_id` UNIQUE constraint enforces one workspace per user. This must become a many-to-many relationship through a `workspace_members` junction table to support teams.

---

## 3. Competitive Landscape

### Market Positioning Analysis

```
                    Enterprise Features
                         ^
                         |
           Jira/Rovo  *  |  * Wrike
                         |
         Smartsheet  *   |   * Monday.com
                         |
                         |  * ClickUp
           Asana  *      |
                         |
    ─────────────────────┼──────────────────────> AI-Native
                         |
             Zenhub  *   |
                         |   * Notion AI
           Linear  *     |
                         |  * Taskade
                         |
                     *   |   * TASKINFA (target)
                 Plane   |
                         |  * Clawdbot/Moltbot
```

**Our target position:** High AI-native capabilities with growing enterprise features. Unlike Clawdbot (conversational, single-user) or Linear (developer-only), we aim for **structured multi-agent project management with enterprise security**.

### What Makes Enterprise Tools Enterprise

Based on analysis of Jira, Wrike, Smartsheet, and ClickUp:

1. **SOC 2 Type II / ISO 27001 compliance** - audit trails, access controls, encryption
2. **SSO/SAML** - centralized identity management
3. **Granular RBAC** - workspace admin, project manager, contributor, viewer roles
4. **Multi-workspace** - department/team isolation with portfolio views
5. **Admin APIs** - programmatic org management
6. **Data residency** - control where data is stored
7. **SLA guarantees** - uptime commitments
8. **Audit logging** - who did what, when, from where

### Key Differentiators We Can Offer

What no competitor currently provides in our combination:

1. **AI agents that execute tasks, not just suggest** - our bots actually write code, not just generate summaries
2. **Multi-agent orchestration via MCP** - standardized protocol for agent communication
3. **Privacy-first architecture** - Cloudflare Workers with D1 (data stays in Cloudflare infrastructure, not shipped to third-party AI providers for training)
4. **Self-evolving capabilities** - agents learn from past executions and improve
5. **Structured + autonomous** - Kanban structure with AI freedom within boundaries
6. **Open architecture** - MCP protocol means any AI model can be plugged in

---

## 4. Lessons from Clawdbot/Moltbot

### Background

Clawdbot (rebranded to Moltbot after Anthropic trademark claim) is an open-source personal AI assistant that gained 60,000+ GitHub stars in days. It runs locally and connects to WhatsApp, Telegram, Discord, and other messaging apps, giving LLMs the ability to execute system commands, browse the web, manage emails, and control smart home devices.

### What They Got Right

1. **"AI with hands" resonates** - people want AI that executes, not just suggests. Our bot architecture aligns with this.
2. **Gateway/adapter pattern** - their WebSocket-based control plane with platform-specific adapters is a clean architecture for multi-channel integration.
3. **Skills/plugins ecosystem** - ClawdHub skill registry creates community flywheel. We should build an automation template system.
4. **Open source builds trust** - MIT license and full transparency drove rapid adoption.
5. **Meeting users where they are** - WhatsApp/Telegram integration removed friction. We should consider notification channels beyond just the web UI.

### What They Got Wrong (Critical Security Lessons)

Clawdbot's security failures are a cautionary tale and an opportunity for us:

1. **Hundreds of internet-facing control panels found via Shodan** - many with zero authentication, exposing shell access, API keys, and full conversation histories (Bitdefender report, Jan 2026).
2. **Prompt injection vulnerabilities** - a malicious email could trick the agent into forwarding private data to an attacker in 5 minutes (Intruder.io demonstration).
3. **No encryption-at-rest** - persistent memory stores credentials in plaintext on disk.
4. **Self-hosting burden** - users misconfigured reverse proxies, bypassing authentication entirely.
5. **Agent sprawl** - no governance over what agents can do, no approval workflows.
6. **Fake VS Code extension** - malicious actors created a fake Clawdbot extension that installed RAT malware (Aikido security report).

### How We Are Inherently Stronger

| Concern | Clawdbot | Taskinfa-Kanban |
|---------|----------|-----------------|
| Execution environment | User's local machine with root access | Cloudflare Workers (sandboxed) + Docker containers (isolated) |
| Authentication | Optional, often misconfigured | Mandatory JWT + API key auth |
| Data storage | Local filesystem, no encryption | Cloudflare D1 (managed, encrypted) |
| Network exposure | Users expose control panels to internet | Cloudflare edge network handles routing |
| Agent permissions | Full system access by default | Scoped to workspace, circuit breakers |
| Self-hosting burden | Users must configure Docker, Tailscale, ports | No self-hosting required (SaaS model) |
| Prompt injection | No defenses documented | Structured task input (not free-form email/chat) |

### What We Should Adopt (Architecturally, Not Code)

1. **Channel adapter pattern** - for notification integrations (Slack, Discord, email)
2. **Skills/template system** - reusable automation workflows that users can share
3. **Gateway concept** - a control plane for managing multiple bot workers
4. **Proactive automation** - scheduled tasks, triggers, and event-driven workflows (not just reactive)

---

## 5. Strategic Improvement Areas

### 5.1 Multi-Workspace & Team Collaboration

**Current state:** Each user gets exactly one workspace. No way to invite team members or share projects.

**Target state:** Users can create multiple workspaces, invite team members, and collaborate on shared projects with granular permissions.

#### Proposed Database Changes

```sql
-- New: workspace_members junction table (replaces 1:1 user-workspace)
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  invited_by TEXT REFERENCES users(id),
  invited_at TEXT DEFAULT (datetime('now')),
  accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended
  UNIQUE(workspace_id, user_id)
);

-- New: workspace invitations
CREATE TABLE workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### Key Implementation Steps

1. **Migration:** Add `workspace_members` table, migrate existing user-workspace relationships
2. **Remove UNIQUE constraint** on `users.workspace_id` (or deprecate the column)
3. **Update auth middleware** to resolve workspace from session context (user may belong to multiple)
4. **Workspace switcher UI** in the dashboard header
5. **Invite flow:** Owner/admin can invite by email, invitee receives link, accepts to join
6. **Activity feed** showing team member actions

#### Impact on Existing Features

- Session token must include the active workspace context
- API endpoints must validate membership, not just workspace existence
- Task assignment can now target human team members, not just bots
- Comments gain richer author context (team member names, avatars)

---

### 5.2 Role-Based Access Control (RBAC)

**Current state:** Single user per workspace, no permission model.

**Target state:** Granular roles controlling access to features, projects, and operations.

#### Proposed Role Hierarchy

```
Owner (1 per workspace)
  ├── Full workspace management
  ├── Billing and plan management
  ├── Delete workspace
  └── All admin permissions

Admin
  ├── Manage members (invite, remove, change roles)
  ├── Manage projects and settings
  ├── Manage API keys and workers
  ├── Create/edit/delete all tasks
  └── View all data

Member
  ├── Create tasks
  ├── Edit own tasks and assigned tasks
  ├── Comment on any task
  ├── View all projects and tasks
  └── Manage own API keys

Viewer
  ├── View projects and tasks (read-only)
  ├── Add comments
  └── No create/edit/delete permissions

Bot (special role)
  ├── Claim and execute assigned tasks
  ├── Update task status
  ├── Add comments (author_type: bot)
  └── Report worker status
```

#### Implementation Approach

```typescript
// Middleware-based permission checking
interface Permission {
  resource: 'workspace' | 'project' | 'task' | 'member' | 'apikey' | 'worker';
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

// Permission matrix resolved from role
function hasPermission(role: WorkspaceRole, permission: Permission): boolean;

// Applied in API routes
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequestUnified(request);
  const membership = await getWorkspaceMembership(auth.userId, auth.workspaceId);

  if (!hasPermission(membership.role, { resource: 'task', action: 'update' })) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  // ... proceed
}
```

#### Project-Level Permissions (Phase 2)

For larger organizations, project-level permissions allow finer control:

```sql
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor', -- lead, contributor, viewer
  UNIQUE(task_list_id, user_id)
);
```

---

### 5.3 Multi-Agent Orchestration

**Current state:** Bots independently poll for tasks. No coordination, no specialization, no routing intelligence.

**Target state:** An orchestration layer that routes tasks to specialized agents, manages dependencies, and enables agent-to-agent collaboration.

#### Architecture: Agent Orchestrator

```
                    ┌─────────────────────────┐
                    │    Web Dashboard (UI)    │
                    │  Task creation, monitoring│
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   Orchestrator Service   │
                    │  (Cloudflare Worker/DO)  │
                    │                          │
                    │  - Task routing engine    │
                    │  - Dependency resolver    │
                    │  - Agent registry         │
                    │  - Execution planner      │
                    │  - Learning feedback loop │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼─────┐ ┌───────▼───────┐ ┌──────▼──────┐
    │  Agent Pool A  │ │ Agent Pool B  │ │ Agent Pool C │
    │  (Frontend)    │ │ (Backend)     │ │ (DevOps)     │
    │                │ │               │ │              │
    │  Skills:       │ │ Skills:       │ │ Skills:      │
    │  - React       │ │ - Node.js     │ │ - Docker     │
    │  - CSS         │ │ - Python      │ │ - CI/CD      │
    │  - TypeScript  │ │ - SQL         │ │ - Terraform  │
    └────────────────┘ └───────────────┘ └──────────────┘
```

#### Agent Specialization

```sql
-- Agent capabilities and specialization
CREATE TABLE agent_profiles (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  specializations TEXT NOT NULL DEFAULT '[]', -- JSON: ["frontend", "react", "css"]
  performance_score REAL DEFAULT 0.5, -- 0.0-1.0, learned over time
  total_tasks_attempted INTEGER DEFAULT 0,
  total_tasks_succeeded INTEGER DEFAULT 0,
  average_loops_to_complete REAL DEFAULT 0,
  preferred_task_types TEXT DEFAULT '[]', -- JSON: ["bug_fix", "feature", "refactor"]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Task Routing Intelligence

The orchestrator routes tasks based on:

1. **Skill matching** - task labels/type matched against agent specializations
2. **Historical performance** - agents with better track records for similar tasks get priority
3. **Availability** - idle agents preferred over busy ones
4. **Load balancing** - distribute work evenly across agents
5. **Dependency awareness** - blocked tasks are not assigned until dependencies resolve

```typescript
interface TaskRoutingDecision {
  taskId: string;
  selectedAgentId: string;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  alternativeAgents: string[];
}

async function routeTask(task: Task, availableAgents: AgentProfile[]): Promise<TaskRoutingDecision> {
  // 1. Filter by specialization match
  // 2. Rank by performance score for similar tasks
  // 3. Weight by current load
  // 4. Return best match with confidence score
}
```

#### Agent-to-Agent Communication

For complex tasks requiring collaboration:

```sql
CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  from_worker_id TEXT NOT NULL REFERENCES workers(id),
  to_worker_id TEXT REFERENCES workers(id), -- NULL = broadcast
  task_id TEXT REFERENCES tasks(id),
  message_type TEXT NOT NULL, -- 'handoff', 'question', 'review_request', 'context_share'
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}', -- JSON
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### Durable Objects for Real-Time Orchestration

Cloudflare Durable Objects can replace SSE polling with true real-time coordination:

```typescript
// Each workspace gets a Durable Object for real-time state
export class WorkspaceOrchestrator implements DurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  private taskQueue: PriorityQueue<Task>;
  private agentRegistry: Map<string, AgentProfile>;

  async fetch(request: Request): Promise<Response> {
    // WebSocket upgrade for real-time communication
    // Task assignment notifications
    // Agent heartbeat management
    // Dependency resolution triggers
  }
}
```

---

### 5.4 Self-Evolving & Learning System

**Current state:** No learning from past executions. Each task execution starts from scratch.

**Target state:** System that learns from successes and failures to improve over time.

#### Learning Data Collection

```sql
-- Execution analytics for learning
CREATE TABLE execution_analytics (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  worker_id TEXT REFERENCES workers(id),

  -- Task characteristics
  task_type TEXT, -- feature, bugfix, refactor, test, docs
  task_complexity TEXT, -- low, medium, high, critical
  labels TEXT DEFAULT '[]',

  -- Execution metrics
  total_loops INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  files_changed_count INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,

  -- Outcome
  final_status TEXT NOT NULL, -- done, review, failed
  success BOOLEAN DEFAULT FALSE,
  circuit_breaker_triggered BOOLEAN DEFAULT FALSE,

  -- Context for learning
  prompt_tokens_used INTEGER DEFAULT 0,
  completion_tokens_used INTEGER DEFAULT 0,
  tools_used TEXT DEFAULT '[]', -- JSON: which MCP tools were called
  error_patterns TEXT DEFAULT '[]', -- JSON: categorized error types

  -- Derived insights
  efficiency_score REAL, -- computed: files_changed / loops

  created_at TEXT DEFAULT (datetime('now'))
);

-- Pattern library: successful strategies
CREATE TABLE execution_patterns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  pattern_type TEXT NOT NULL, -- 'task_strategy', 'error_recovery', 'optimization'
  trigger_conditions TEXT NOT NULL, -- JSON: when to apply this pattern
  strategy TEXT NOT NULL, -- JSON: what to do
  success_rate REAL DEFAULT 0.0,
  times_applied INTEGER DEFAULT 0,
  times_succeeded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Learning Feedback Loop

```
Task Completed
     │
     ▼
┌─────────────────────┐
│ Collect Metrics      │
│ - Duration, loops    │
│ - Errors, files      │
│ - Token usage        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Analyze Patterns     │
│ - Similar past tasks │
│ - Error patterns     │
│ - Success strategies │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Update Models        │
│ - Agent performance  │
│ - Task complexity    │
│ - Routing weights    │
│ - Prompt templates   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Apply to Future Tasks│
│ - Better prompts     │
│ - Smarter routing    │
│ - Predicted duration │
│ - Risk assessment    │
└─────────────────────┘
```

#### Practical Learning Applications

1. **Prompt Enhancement:** Analyze which task descriptions lead to faster completion. Suggest improvements to task descriptions before execution.

2. **Error Pattern Library:** Build a database of common errors and their resolutions. When a bot encounters a known error pattern, provide the resolution context automatically.

3. **Complexity Estimation:** After enough data, predict how many loops a task will need based on its description, labels, and project context. Use this for capacity planning.

4. **Agent Matching:** Learn which agents perform best on which types of tasks. The frontend specialist bot should get CSS tasks, not the backend specialist.

5. **Automatic Retries with Context:** When a task fails, the system can analyze the failure, select a different agent, and provide the failure context so the new agent learns from the previous attempt.

---

### 5.5 Web UI Autonomy (No Terminal Required)

**Current state:** Users must use Docker CLI and terminal to manage bots, run migrations, and configure workers.

**Target state:** Everything manageable from the web dashboard after initial deployment.

#### Bot/Worker Management UI

```
┌──────────────────────────────────────────────────────────┐
│  Workers & Agents                               [+ Add]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🟢 worker-alpha     │ Idle      │ Tasks: 47  │ ⚙️  │ │
│  │    Specialization: Frontend, React                  │ │
│  │    Last active: 2 minutes ago                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🔵 worker-beta      │ Working   │ Tasks: 31  │ ⚙️  │ │
│  │    Specialization: Backend, API                     │ │
│  │    Current: "Fix auth token refresh" (loop 3/50)    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 🔴 worker-gamma     │ Offline   │ Tasks: 12  │ ⚙️  │ │
│  │    Specialization: DevOps                           │ │
│  │    Last seen: 3 hours ago                           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Features to Add to the Web UI

| Feature | Priority | Description |
|---------|----------|-------------|
| **Worker registration wizard** | High | Step-by-step guide to set up a new worker with generated Docker commands |
| **Worker configuration** | High | Edit worker settings (max loops, circuit breaker thresholds) from UI |
| **Worker logs viewer** | High | Stream worker execution logs in real-time |
| **API key management** | Done | Already implemented |
| **Project settings** | Medium | Configure repo URL, working directory, default branch from UI |
| **Task templates** | Medium | Create reusable task templates for common operations |
| **Bulk task operations** | Medium | Select multiple tasks, bulk move/delete/assign |
| **Task search & filter** | Medium | Full-text search, filter by label/assignee/date |
| **Dashboard analytics** | Medium | Task completion rates, average execution time, error rates |
| **Migration runner** | Low | Apply database migrations from the UI (admin only) |
| **Webhook configuration** | Medium | Set up webhooks for external integrations from UI |
| **Notification preferences** | Medium | Choose what events trigger notifications and via which channel |

#### Worker Setup Wizard Flow

```
Step 1: Name your worker
  └─ Input: Worker name, specialization tags

Step 2: Generate credentials
  └─ Auto-generate API key, display Docker run command

Step 3: Configure execution
  └─ Max loops, circuit breaker, working directory

Step 4: Copy & run
  └─ One-click copy of complete Docker command
  └─ Or: download docker-compose.yml

Step 5: Verify connection
  └─ Real-time check that worker heartbeat is received
```

#### Task Creation Enhancements

```
┌──────────────────────────────────────────────────────────┐
│  Create Task                                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Title: [________________________________]               │
│                                                          │
│  Description:                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Rich markdown editor with preview                │    │
│  │                                                  │    │
│  │ Supports:                                        │    │
│  │ - Code blocks                                    │    │
│  │ - Checklists                                     │    │
│  │ - File references                                │    │
│  │ - @mentions                                      │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Project: [Dropdown________▼]                            │
│  Priority: [○ Low  ● Medium  ○ High  ○ Urgent]          │
│  Labels:  [frontend] [bug] [+ add]                       │
│                                                          │
│  ─── Advanced ──────────────────────────────────         │
│  Template: [Select template...▼]                         │
│  Assign to: [○ Auto-route  ○ Specific worker  ○ Human]  │
│  Dependencies: [Select blocking tasks...]                │
│  Due date: [____________]                                │
│  Subtasks: [+ Add subtask]                               │
│                                                          │
│  [AI Suggest] [Create]  [Create & Assign]                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

The **[AI Suggest]** button would analyze the task description and suggest:
- Appropriate priority and labels
- Best agent for the job
- Estimated complexity
- Potential subtask breakdown
- Similar past tasks and their outcomes

---

### 5.6 Task Intelligence & Automation

**Current state:** Tasks are manually created and assigned. No dependencies, subtasks, or automation rules.

**Target state:** Intelligent task management with dependencies, automation rules, and AI-powered workflows.

#### Task Dependencies

```sql
CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks', -- blocks, relates_to, duplicates
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(task_id, depends_on_task_id),
  CHECK(task_id != depends_on_task_id)
);
```

The orchestrator checks dependencies before assigning tasks:
- A task with unresolved `blocks` dependencies stays in backlog
- When a blocking task completes, dependents are automatically moved to `todo`
- Circular dependency detection prevents deadlocks

#### Subtask Hierarchy

```sql
-- Add to tasks table
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN depth INTEGER DEFAULT 0; -- max 3 levels
```

#### Automation Rules Engine

```sql
CREATE TABLE automation_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'status_change', 'label_added', 'priority_change', 'schedule', 'webhook'
  trigger_conditions TEXT NOT NULL, -- JSON: conditions that activate the rule
  actions TEXT NOT NULL, -- JSON: actions to perform
  is_active BOOLEAN DEFAULT TRUE,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Example Automation Rules

```json
// Rule: Auto-assign urgent tasks to the fastest available agent
{
  "trigger_type": "status_change",
  "trigger_conditions": {
    "new_status": "todo",
    "priority": "urgent"
  },
  "actions": [
    {
      "type": "auto_assign",
      "strategy": "best_performer",
      "fallback": "round_robin"
    },
    {
      "type": "notify",
      "channels": ["slack", "email"],
      "message": "Urgent task {{task.title}} has been auto-assigned to {{agent.name}}"
    }
  ]
}

// Rule: When all subtasks are done, mark parent as review
{
  "trigger_type": "status_change",
  "trigger_conditions": {
    "new_status": "done",
    "has_parent": true,
    "all_siblings_done": true
  },
  "actions": [
    {
      "type": "update_task",
      "target": "parent",
      "fields": { "status": "review" }
    }
  ]
}

// Rule: Create review task when feature task is done
{
  "trigger_type": "status_change",
  "trigger_conditions": {
    "new_status": "done",
    "labels_include": ["feature"]
  },
  "actions": [
    {
      "type": "create_task",
      "title": "Review: {{task.title}}",
      "description": "Review the completed feature task and verify implementation quality.",
      "priority": "high",
      "labels": ["review", "qa"]
    }
  ]
}
```

#### Task Templates

```sql
CREATE TABLE task_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_data TEXT NOT NULL, -- JSON: task fields + subtask definitions
  category TEXT, -- 'bug_fix', 'feature', 'refactor', 'deployment'
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

### 5.7 Security & Privacy Hardening

**Current state:** Good baseline (JWT, hashed passwords, hashed API keys, workspace isolation). Missing enterprise security features.

**Target state:** Enterprise-grade security with compliance readiness.

#### Priority Security Improvements

| Feature | Priority | Implementation |
|---------|----------|---------------|
| **Rate limiting** | Critical | Cloudflare Rate Limiting API (not in-memory) |
| **CSRF protection** | High | Double-submit cookie pattern for state-changing requests |
| **Audit logging** | High | Structured log of all security-relevant actions |
| **2FA/MFA** | High | TOTP-based (Google Authenticator compatible) |
| **Session management** | High | Active session list, remote session revocation |
| **API key scoping** | Medium | Per-key permission scopes (read-only, task-only, admin) |
| **Input sanitization** | Medium | Centralized sanitization middleware |
| **Content Security Policy** | Medium | Strict CSP headers |
| **Secrets rotation** | Medium | Automated JWT secret rotation |
| **IP allowlisting** | Low | Optional IP restrictions for API keys |

#### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  actor_type TEXT NOT NULL, -- 'user', 'bot', 'system', 'api_key'
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'task.create', 'task.update', 'member.invite', 'auth.login', etc.
  resource_type TEXT NOT NULL, -- 'task', 'project', 'member', 'workspace', 'api_key'
  resource_id TEXT,
  details TEXT, -- JSON: action-specific details
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at);
```

#### Rate Limiting Strategy

Since Cloudflare Workers can't use in-memory counters (stateless), use one of:

1. **Cloudflare Rate Limiting Rules** (recommended) - configure via Cloudflare dashboard or API, zero code changes
2. **D1-based rate limiting** - store request counts in D1, check on each request (adds latency)
3. **Durable Objects** - per-IP Durable Object with in-memory counters (most flexible but adds cost)

Recommended approach for different endpoints:

```
/api/auth/login    → 5 requests per minute per IP (Cloudflare Rate Limiting)
/api/auth/signup   → 3 requests per minute per IP (Cloudflare Rate Limiting)
/api/tasks/*       → 100 requests per minute per API key (D1 or DO counter)
/api/tasks/stream  → 1 connection per user (enforced in SSE handler)
```

#### Two-Factor Authentication

```sql
ALTER TABLE users ADD COLUMN totp_secret TEXT; -- encrypted TOTP secret
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN recovery_codes TEXT; -- JSON: hashed recovery codes
```

Flow:
1. User enables 2FA in settings
2. Generate TOTP secret, display QR code
3. User scans with authenticator app, enters verification code
4. Store encrypted secret, generate recovery codes
5. Login now requires password + TOTP code
6. Recovery codes as fallback

---

### 5.8 Integration Ecosystem

**Current state:** MCP protocol for bot communication. No external integrations.

**Target state:** Rich integration ecosystem with notifications, source control, and communication tools.

#### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  Notifications│  Source Code  │  Communication│  Webhooks    │
│              │              │              │               │
│  - Email     │  - GitHub    │  - Slack     │  - Inbound    │
│  - Push      │  - GitLab    │  - Discord   │  - Outbound   │
│  - SMS       │  - Bitbucket │  - Teams     │  - Custom     │
│              │              │              │               │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

#### GitHub Integration (High Priority)

This is the most impactful integration for a development-focused PM tool:

```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'github', 'slack', 'discord', 'webhook'
  config TEXT NOT NULL, -- JSON: encrypted configuration
  status TEXT NOT NULL DEFAULT 'active', -- active, disabled, error
  last_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

GitHub integration features:
1. **Bidirectional sync:** Tasks <-> GitHub Issues
2. **PR linking:** Associate PRs with tasks automatically (via branch naming convention)
3. **Status sync:** PR merged -> task moves to "review" or "done"
4. **Auto-task creation:** New GitHub issues -> Kanban tasks
5. **Commit tracking:** Link commits to tasks

#### Webhook System

```sql
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- for HMAC signature verification
  events TEXT NOT NULL DEFAULT '[]', -- JSON: subscribed events
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TEXT,
  failure_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Webhook events:
- `task.created`, `task.updated`, `task.deleted`, `task.status_changed`
- `task.assigned`, `task.completed`, `task.failed`
- `worker.online`, `worker.offline`, `worker.error`
- `member.joined`, `member.left`

#### Notification System

```sql
CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'email', 'slack', 'discord', 'in_app'
  events TEXT NOT NULL DEFAULT '[]', -- JSON: which events
  config TEXT DEFAULT '{}', -- JSON: channel-specific config (e.g., Slack webhook URL)
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, workspace_id, channel)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL, -- event type
  title TEXT NOT NULL,
  body TEXT,
  link TEXT, -- deep link into the app
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

### 5.9 Observability & Audit System

**Current state:** Worker status badges and task comments. No structured observability.

**Target state:** Comprehensive observability with dashboards, metrics, and alerts.

#### Analytics Dashboard

```
┌──────────────────────────────────────────────────────────┐
│  Project Analytics: Taskinfa-Kanban                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Tasks     │ │ Completed│ │ Avg Time │ │ Success  │   │
│  │ Active    │ │ This Week│ │ Per Task │ │ Rate     │   │
│  │    12     │ │    34    │ │  8 loops │ │   87%    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  Task Completion Over Time                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │  ▄▄                                              │    │
│  │  ██ ▄▄    ▄▄                                     │    │
│  │  ██ ██    ██ ▄▄ ▄▄                               │    │
│  │  ██ ██ ▄▄ ██ ██ ██ ▄▄    ▄▄                     │    │
│  │  ██ ██ ██ ██ ██ ██ ██ ▄▄ ██ ▄▄                  │    │
│  │  Mon Tue Wed Thu Fri Sat Sun Mon Tue             │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Agent Performance                                       │
│  ┌─────────────┬───────┬─────────┬──────────────────┐   │
│  │ Agent       │ Tasks │ Success │ Avg Loops        │   │
│  ├─────────────┼───────┼─────────┼──────────────────┤   │
│  │ worker-alpha│  47   │  91%    │  6.2             │   │
│  │ worker-beta │  31   │  84%    │  9.1             │   │
│  │ worker-gamma│  12   │  75%    │  12.3            │   │
│  └─────────────┴───────┴─────────┴──────────────────┘   │
│                                                          │
│  Common Error Patterns                                   │
│  • Type errors in React components (23%)                 │
│  • Database migration failures (15%)                     │
│  • Test failures on CI (12%)                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Metrics to Track

```typescript
interface WorkspaceMetrics {
  // Task metrics
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksCompletedThisWeek: number;
  averageCompletionLoops: number;
  taskSuccessRate: number;

  // Agent metrics
  activeAgents: number;
  agentUtilization: number; // % of time agents are working
  agentPerformance: AgentMetrics[];

  // Error metrics
  errorRate: number;
  circuitBreakerActivations: number;
  topErrorPatterns: ErrorPattern[];

  // Velocity
  tasksCompletedPerDay: number[];
  burndownData: BurndownPoint[];
  velocityTrend: 'improving' | 'stable' | 'declining';
}
```

---

### 5.10 Enterprise Deployment Options

**Current state:** Cloudflare Workers SaaS only.

**Target state:** Multiple deployment options for different enterprise needs.

#### Deployment Tiers

| Tier | Target | Deployment | Data Residency |
|------|--------|-----------|----------------|
| **Cloud (Free/Pro)** | Individuals, small teams | Cloudflare Workers (shared) | Cloudflare global network |
| **Cloud (Enterprise)** | Large teams | Cloudflare Workers (dedicated) | Region-specific D1 |
| **Self-Hosted** | Security-conscious orgs | Docker Compose on customer infrastructure | Customer-controlled |
| **Hybrid** | Enterprise with compliance needs | Dashboard on Cloudflare, bots on customer infra | Split: metadata in cloud, code on-premise |

The **Hybrid** model is uniquely suited to our architecture:
- Dashboard and task management run on Cloudflare (globally available, managed)
- Bot workers run inside customer's network (access to private repos, internal tools)
- Communication via API keys over HTTPS (already implemented)
- Customer's code never leaves their infrastructure

---

## 6. Architecture Evolution Plan

### Current Architecture
```
Browser ──── Cloudflare Workers (Next.js) ──── D1 Database
                                                    │
Docker Container (Bot) ── MCP ── Claude Code CLI ───┘
```

### Target Architecture (Phase 3)
```
                    ┌──────────────────────────────┐
                    │     Cloudflare Workers        │
                    │                              │
Browser ────────────┤  Next.js Dashboard           │
Mobile App ─────────┤  REST API                    │
Slack Bot ──────────┤  WebSocket (DO)              ├──── D1 Database
GitHub Webhook ─────┤  Orchestrator (DO)           │
API Consumers ──────┤  Webhook Dispatcher          │
                    │  Notification Service        │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┼───────────────┐
                    │              │               │
              Agent Pool A   Agent Pool B    Agent Pool C
              (Docker/Cloud)  (Docker/Cloud)  (Docker/Cloud)
                    │              │               │
              Claude Code    Claude Code     Claude Code
              GPT-4          Local LLM       Custom Model
```

### Key Architecture Decisions

1. **Durable Objects** for real-time orchestration (replaces SSE polling)
2. **Event-driven** automation rules engine
3. **Plugin architecture** for integrations (adapter pattern from Clawdbot)
4. **Model-agnostic** agent execution (not locked to Claude Code)
5. **API-first** design (dashboard is just another API consumer)

---

## 7. Database Schema Evolution

### Migration Roadmap

| Migration | Phase | Tables/Changes |
|-----------|-------|----------------|
| 006 | 1 | `workspace_members`, `workspace_invitations` |
| 007 | 1 | `audit_logs` |
| 008 | 1 | `task_dependencies`, add `parent_task_id` to tasks |
| 009 | 2 | `automation_rules`, `task_templates` |
| 010 | 2 | `agent_profiles`, `execution_analytics` |
| 011 | 2 | `notifications`, `notification_preferences` |
| 012 | 2 | `integrations`, `webhooks` |
| 013 | 3 | `agent_messages`, `execution_patterns` |
| 014 | 3 | `project_members` (project-level RBAC) |
| 015 | 3 | 2FA columns on users table |

---

## 8. Implementation Phases

### Phase 1: Team Foundation (Weeks 1-4)

**Goal:** Enable team collaboration and basic security hardening.

| Task | Priority | Effort |
|------|----------|--------|
| Multi-workspace membership (workspace_members table) | Critical | Large |
| Workspace invitation flow | Critical | Medium |
| RBAC middleware and permission checks | Critical | Large |
| Workspace switcher UI | Critical | Medium |
| Audit logging infrastructure | High | Medium |
| Rate limiting via Cloudflare Rules | High | Small |
| CSRF protection | High | Small |
| Task dependencies (blocks/blocked-by) | High | Medium |
| Subtask hierarchy (parent_task_id) | Medium | Medium |
| Task search and filtering UI | Medium | Medium |

**Success criteria:** Multiple users can collaborate in a shared workspace with proper role enforcement.

### Phase 2: Intelligence Layer (Weeks 5-10)

**Goal:** Add automation, learning, and self-service bot management.

| Task | Priority | Effort |
|------|----------|--------|
| Worker management wizard in UI | Critical | Large |
| Worker execution log viewer | High | Medium |
| Task templates system | High | Medium |
| Automation rules engine | High | Large |
| Execution analytics collection | High | Medium |
| Agent specialization profiles | Medium | Medium |
| Intelligent task routing | Medium | Large |
| Dashboard analytics page | Medium | Large |
| Bulk task operations | Medium | Small |
| Notification system (in-app) | Medium | Medium |

**Success criteria:** Users can manage workers entirely from the web UI. Basic automation rules work. Analytics dashboard shows execution metrics.

### Phase 3: Enterprise & Integrations (Weeks 11-18)

**Goal:** Enterprise security, external integrations, and advanced AI features.

| Task | Priority | Effort |
|------|----------|--------|
| GitHub integration (bidirectional sync) | High | Large |
| Webhook system (outbound) | High | Medium |
| Slack/Discord notifications | High | Medium |
| Two-factor authentication | High | Medium |
| API key scoping (permissions per key) | Medium | Medium |
| Self-evolving pattern library | Medium | Large |
| Agent-to-agent communication | Medium | Large |
| Durable Objects for real-time (replace SSE polling) | Medium | Large |
| Email notifications | Medium | Medium |
| Session management UI | Medium | Small |
| Project-level permissions | Low | Medium |
| Content Security Policy headers | Low | Small |

**Success criteria:** GitHub integration works bidirectionally. Webhook and Slack notifications functional. 2FA available. System learns from past executions.

### Phase 4: Platform Maturity (Weeks 19-26)

**Goal:** Polish, performance, and platform capabilities.

| Task | Priority | Effort |
|------|----------|--------|
| Model-agnostic agent execution (support GPT, local LLMs) | High | Large |
| Advanced analytics and reporting | Medium | Large |
| Automation template marketplace | Medium | Large |
| Mobile-responsive improvements | Medium | Medium |
| Self-hosted deployment option (Docker Compose) | Medium | Large |
| API documentation (OpenAPI/Swagger) | Medium | Medium |
| Comprehensive test suite | Medium | Large |
| Performance optimization (caching, query optimization) | Low | Medium |
| Accessibility improvements (WCAG 2.1) | Low | Medium |
| Internationalization (i18n) | Low | Large |

**Success criteria:** Platform supports multiple LLM providers. Self-hosted option available. Comprehensive test coverage.

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **D1 scalability limits** | Medium | High | Monitor query performance; plan migration to Turso or PlanetScale if needed |
| **Agent sprawl** (uncontrolled bot behavior) | Medium | High | Circuit breakers, execution budgets, human approval gates |
| **Prompt injection** via task descriptions | Medium | High | Sanitize task descriptions, sandbox execution, validate outputs |
| **Multi-tenant data leakage** | Low | Critical | Strict workspace_id filtering in every query, integration tests |
| **SSE polling at scale** | High | Medium | Migrate to Durable Objects / WebSockets in Phase 3 |
| **Complexity creep** | High | Medium | Strict phase gating, MVP for each feature, user feedback loops |
| **API key compromise** | Low | High | Key rotation, scoped permissions, audit logging, IP allowlisting |
| **Bot execution costs** | Medium | Medium | Execution budgets per workspace, token usage tracking |
| **Migration failures on production** | Low | High | Test migrations on test DB first, automated rollback scripts |
| **Competitor catch-up** | Medium | Medium | Focus on unique differentiators: privacy-first, self-evolving, multi-agent |

### Security-Specific Risks (Lessons from Clawdbot)

| Risk | Our Exposure | Mitigation |
|------|-------------|------------|
| **Exposed control panels** | Low - Cloudflare handles routing | No self-hosted management ports exposed |
| **Prompt injection via external data** | Medium - task descriptions are user input | Sanitize, validate, sandbox execution environment |
| **Credential leakage** | Low - secrets in Cloudflare env vars | Never log secrets, rotate on suspicion, audit access |
| **Malicious integrations** | Future risk when integrations ship | Strict OAuth scopes, permission prompts, audit trail |
| **Agent executing harmful code** | Medium - bots run Claude Code | Docker isolation, restricted network access, execution budgets |

---

## 10. Research Sources

### Competitive Analysis
- [Epicflow - Best AI Project Management Tools 2026](https://www.epicflow.com/blog/excellent-ai-project-management-software-tools-setting-new-standards/)
- [Forecast - 10 Best AI PM Tools 2026](https://www.forecast.app/blog/10-best-ai-project-management-software)
- [Zapier - 6 Best AI PM Tools 2026](https://zapier.com/blog/best-ai-project-management-tools/)
- [Digital PM - 20 Best AI PM Tools](https://thedigitalprojectmanager.com/tools/best-ai-project-management-tools/)
- [Siit - Linear App Review](https://www.siit.io/tools/trending/linear-app-review)
- [Efficient App - Linear Review 2026](https://efficient.app/apps/linear)

### Enterprise & AI
- [Atlassian - Rovo AI in Jira](https://www.atlassian.com/software/jira/ai)
- [eesel AI - Atlassian Intelligence](https://www.eesel.ai/blog/atlassian-intelligence-ai-in-jira)
- [Epicflow - AI Agents for PM](https://www.epicflow.com/blog/ai-agents-for-project-management/)
- [RT Insights - Multi-Agent Systems 2026](https://www.rtinsights.com/if-2025-was-the-year-of-ai-agents-2026-will-be-the-year-of-multi-agent-systems/)
- [arXiv - Toward Agentic Software Project Management](https://arxiv.org/html/2601.16392)
- [Machine Learning Mastery - Agentic AI Trends 2026](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/)

### Privacy & Open Source
- [Plane - Self-Hosted PM](https://plane.so/blog/self-hosted-project-management-jira-server-alternative)
- [Worklenz - Self-Hosted PM Software](https://worklenz.com/blog/top-self-hosted-project-management-software-2025/)
- [OpenProject](https://www.openproject.org/)
- [OpenProject Roadmap](https://www.openproject.org/roadmap/)
- [GitHub - Agentic PM Framework](https://github.com/sdi2200262/agentic-project-management)

### Clawdbot/Moltbot Analysis
- [Tom's Hardware - Exploring Clawdbot](https://www.tomshardware.com/tech-industry/artificial-intelligence/exploring-clawdbot-the-ai-agent-taking-the-internet-by-storm)
- [Bitdefender - Exposed Control Panels](https://www.bitdefender.com/en-us/blog/hotforsecurity/moltbot-security-alert-exposed-clawdbot-control-panels-risk-credential-leaks-and-account-takeovers)
- [Intruder - Security Nightmare](https://www.intruder.io/blog/clawdbot-when-easy-ai-becomes-a-security-nightmare)
- [Aikido - Fake VS Code Extension](https://www.aikido.dev/blog/fake-clawdbot-vscode-extension-malware)
- [The Register - Security Concerns](https://www.theregister.com/2026/01/27/clawdbot_moltbot_security_concerns/)
- [DigitalOcean - How Moltbot Works](https://www.digitalocean.com/community/conceptual-articles/moltbot-behind-the-scenes)
- [DataCamp - Moltbot Tutorial](https://www.datacamp.com/tutorial/moltbot-clawdbot-tutorial)

### Self-Evolving AI
- [Cogent - AI-Driven Self-Evolving Software](https://www.cogentinfo.com/resources/ai-driven-self-evolving-software-the-rise-of-autonomous-codebases-by-2026)
- [Times of AI - Self-Improving AI](https://www.timesofai.com/industry-insights/self-improving-ai-myth-or-reality/)
- [NextGen Tools - Autonomous PM Tools 2026](https://www.nxgntools.com/blog/autonomous-project-management-tools-2026)
- [PMI - Future of PM With AI](https://www.pmi.org/learning/thought-leadership/shaping-the-future-of-project-management-with-ai)
- [SAP - AI in 2026](https://news.sap.com/2026/01/ai-in-2026-five-defining-themes/)

---

*This document serves as the strategic foundation for Taskinfa-Kanban's evolution toward enterprise-grade, multi-agent project management. Each section can be expanded into detailed implementation specifications as phases begin.*
