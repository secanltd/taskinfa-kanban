// Core domain types

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
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

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  labels: string[]; // JSON array
  assignee: string | null;
  assigned_to: string | null; // Bot name that claimed this task

  // Execution metadata
  loop_count: number;
  error_count: number;
  files_changed: string[]; // JSON array
  completion_notes: string | null;

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

// API request/response types

export interface ListTasksRequest {
  workspace_id?: string;
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
