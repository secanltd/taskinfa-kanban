// Core domain types

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

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

export interface ApiKey {
  id: string;
  workspace_id: string;
  key_hash: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

// API request/response types

export interface ListTasksRequest {
  workspace_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
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

// Bot execution types

export interface BotConfig {
  apiKey: string;
  workspaceId: string;
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
