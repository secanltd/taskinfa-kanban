// Core domain types

export type TaskStatus = 'backlog' | 'refinement' | 'todo' | 'review_rejected' | 'in_progress' | 'ai_review' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CommentType = 'progress' | 'question' | 'summary' | 'error';
export type AuthorType = 'bot' | 'user';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskList {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  repository_url: string | null;
  working_directory: string;
  slug: string | null;
  is_active: boolean;
  is_initialized: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  task_list_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  labels: string[]; // JSON array
  assignee: string | null;
  assigned_to: string | null; // Bot name that claimed this task
  order: number; // Position within status column (0 = top)

  // Execution metadata
  loop_count: number;
  error_count: number;
  files_changed: string[]; // JSON array
  completion_notes: string | null;

  // PR integration
  pr_url: string | null;
  branch_name: string | null;

  // Time tracking
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  workspace_id: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  user_id: string | null;
  key_hash: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author: string;
  author_type: AuthorType;
  content: string;
  comment_type: CommentType;
  loop_number: number | null;
  created_at: string;
}

export type WorkerStatus = 'idle' | 'working' | 'offline' | 'error';

export interface Worker {
  id: string;
  workspace_id: string;
  name: string;
  status: WorkerStatus;
  current_task_id: string | null;
  last_heartbeat: string | null;
  total_tasks_completed: number;
  created_at: string;
  updated_at: string;
}

export interface WorkerWithTask extends Worker {
  current_task?: {
    id: string;
    title: string | null;
  } | null;
  last_seen: string;
}

// V2 Session types (replaces Docker workers)

export type SessionStatus = 'active' | 'idle' | 'stuck' | 'completed' | 'error';

export type SessionEventType =
  | 'task_claimed'
  | 'task_progress'
  | 'task_completed'
  | 'stuck'
  | 'needs_input'
  | 'error'
  | 'session_start'
  | 'session_end'
  | 'notification';

export interface Session {
  id: string;
  workspace_id: string;
  project_id: string | null;
  current_task_id: string | null;
  status: SessionStatus;
  started_at: string;
  last_event_at: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionWithDetails extends Session {
  project_name?: string | null;
  current_task_title?: string | null;
}

export interface SessionEvent {
  id: string;
  session_id: string | null;
  task_id: string | null;
  event_type: SessionEventType;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationConfig {
  id: string;
  workspace_id: string;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  notify_on_complete: boolean;
  notify_on_stuck: boolean;
  notify_on_error: boolean;
  created_at: string;
  updated_at: string;
}

// V2 API request/response types

export interface CreateSessionRequest {
  workspace_id?: string;
  project_id?: string;
  current_task_id?: string;
  status?: SessionStatus;
  summary?: string;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface UpdateSessionRequest {
  status?: SessionStatus;
  current_task_id?: string | null;
  summary?: string;
  last_event_at?: string;
}

export interface UpdateSessionResponse {
  session: Session;
}

export interface ListSessionsResponse {
  sessions: SessionWithDetails[];
  stats: {
    active: number;
    idle: number;
    stuck: number;
    completed: number;
    error: number;
  };
}

export interface CreateEventRequest {
  session_id?: string;
  task_id?: string;
  event_type: SessionEventType;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateEventResponse {
  event: SessionEvent;
}

export interface ListEventsResponse {
  events: SessionEvent[];
  total: number;
}

export interface UpdateNotificationConfigRequest {
  telegram_chat_id?: string;
  telegram_enabled?: boolean;
  notify_on_complete?: boolean;
  notify_on_stuck?: boolean;
  notify_on_error?: boolean;
}

// API request/response types

export interface ListTasksRequest {
  workspace_id?: string;
  task_list_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  limit?: number;
}

export interface ListTasksResponse {
  tasks: Task[];
  total: number;
}

export interface GetTaskRequest {
  id: string;
}

export interface GetTaskResponse {
  task: Task;
}

export interface UpdateTaskStatusRequest {
  id: string;
  status: TaskStatus;
  completion_notes?: string;
  files_changed?: string[];
  error_count?: number;
  loop_count?: number;
  assigned_to?: string;
}

export interface UpdateTaskStatusResponse {
  task: Task;
}

export interface CreateTaskRequest {
  workspace_id: string;
  task_list_id?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  labels?: string[];
}

export interface CreateTaskResponse {
  task: Task;
}

// Comment request/response types

export interface AddTaskCommentRequest {
  task_id: string;
  author: string;
  author_type: AuthorType;
  content: string;
  comment_type: CommentType;
  loop_number?: number;
}

export interface AddTaskCommentResponse {
  comment: TaskComment;
}

export interface ListTaskCommentsRequest {
  task_id: string;
  limit?: number;
  offset?: number;
}

export interface ListTaskCommentsResponse {
  comments: TaskComment[];
  total: number;
}

export interface ClaimTaskRequest {
  task_id: string;
  bot_name: string;
}

export interface ClaimTaskResponse {
  success: boolean;
  task?: Task;
  message?: string;
}

// Bot execution types

export interface BotConfig {
  apiKey: string;
  workspaceId: string;
  botName: string;
  mcpServerUrl?: string;
  restApiUrl?: string;
  maxLoops?: number;
  circuitBreakerThreshold?: number;
}

export interface ExecutionContext {
  task: Task;
  loopCount: number;
  errorCount: number;
  filesChanged: Set<string>;
  lastProgress: number;
}

export interface ClaudeCodeOutput {
  text: string;
  exitSignal: boolean;
  completionIndicators: number;
  filesModified: string[];
  errors: string[];
}

// MCP Tool types

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Authentication types

export interface SessionPayload {
  userId: string;
  workspaceId: string;
  type: 'user';
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignupResponse {
  user: Omit<User, 'password_hash'>;
  workspace: Workspace;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  workspace: Workspace;
}

export interface GetMeResponse {
  user: Omit<User, 'password_hash'>;
  workspace: Workspace;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresInDays?: number;
}

export interface CreateApiKeyResponse {
  key: string;
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  warning: string;
}

export interface ListApiKeysResponse {
  keys: Array<{
    id: string;
    name: string;
    key_preview: string;
    last_used_at: string | null;
    created_at: string;
    expires_at: string | null;
    is_active: boolean;
  }>;
}

export interface UpdateApiKeyRequest {
  name?: string;
}

export interface UpdateApiKeyResponse {
  success: boolean;
  key: {
    id: string;
    name: string;
  };
}

// Feature toggle types

export type FeatureKey = 'refinement' | 'ai_review';

export interface RefinementConfig {
  auto_advance: boolean;
}

export interface AiReviewConfig {
  auto_advance_on_approve: boolean;
  max_review_rounds: number;
}

export type FeatureConfigMap = {
  refinement: RefinementConfig;
  ai_review: AiReviewConfig;
};

export interface FeatureToggle {
  id: string;
  workspace_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ListFeatureTogglesResponse {
  toggles: FeatureToggle[];
}

export interface UpdateFeatureToggleRequest {
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateFeatureToggleResponse {
  toggle: FeatureToggle;
}

export const DEFAULT_FEATURE_CONFIGS: Record<FeatureKey, Record<string, unknown>> = {
  refinement: { auto_advance: true },
  ai_review: { auto_advance_on_approve: true, max_review_rounds: 3 },
};

// Column definitions for the kanban board

export interface StatusColumn {
  status: TaskStatus;
  label: string;
  icon: string;
  featureKey?: FeatureKey;
}

/** Base columns always present on the board */
const BASE_COLUMNS: StatusColumn[] = [
  { status: 'backlog', label: 'Backlog', icon: '📋' },
  { status: 'todo', label: 'To Do', icon: '📝' },
  { status: 'in_progress', label: 'In Progress', icon: '⚡' },
  { status: 'review', label: 'Review', icon: '👀' },
  { status: 'done', label: 'Done', icon: '✅' },
];

/** Feature-gated columns inserted at specific positions */
const FEATURE_COLUMNS: Record<FeatureKey, StatusColumn[]> = {
  refinement: [
    { status: 'refinement', label: 'Refinement', icon: '🔍', featureKey: 'refinement' },
  ],
  ai_review: [
    { status: 'ai_review', label: 'AI Review', icon: '🤖', featureKey: 'ai_review' },
    { status: 'review_rejected', label: 'Review Rejected', icon: '🔄', featureKey: 'ai_review' },
  ],
};

/**
 * Build the dynamic status columns array based on enabled feature toggles.
 * Full order with both features: Backlog -> Refinement -> To Do -> Review Rejected -> In Progress -> AI Review -> Review -> Done
 */
export function getStatusColumns(enabledFeatures: Record<FeatureKey, boolean>): StatusColumn[] {
  const columns: StatusColumn[] = [];

  for (const base of BASE_COLUMNS) {
    // Insert refinement between Backlog and To Do
    if (base.status === 'todo' && enabledFeatures.refinement) {
      columns.push(...FEATURE_COLUMNS.refinement);
    }

    columns.push(base);

    // Insert review_rejected between To Do and In Progress
    if (base.status === 'todo' && enabledFeatures.ai_review) {
      columns.push(FEATURE_COLUMNS.ai_review.find(c => c.status === 'review_rejected')!);
    }

    // Insert ai_review after In Progress
    if (base.status === 'in_progress' && enabledFeatures.ai_review) {
      columns.push(FEATURE_COLUMNS.ai_review.find(c => c.status === 'ai_review')!);
    }
  }

  return columns;
}

/**
 * Get the list of valid task statuses for a workspace based on enabled feature toggles.
 */
export function getValidStatuses(enabledFeatures: Record<FeatureKey, boolean>): TaskStatus[] {
  return getStatusColumns(enabledFeatures).map(c => c.status);
}
