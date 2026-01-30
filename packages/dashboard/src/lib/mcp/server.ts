// MCP Server Implementation for Taskinfa-Bot
// Exposes task management tools to Claude Code sessions

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  Task,
  TaskList,
  TaskComment,
  ListTasksRequest,
  GetTaskRequest,
  UpdateTaskStatusRequest,
  AddTaskCommentRequest,
  ListTaskCommentsRequest,
  ClaimTaskRequest,
  CreateTaskRequest,
  TaskStatus,
} from '@taskinfa/shared';
import { getDb, query, queryOne, execute } from '../db/client';
import { safeJsonParseArray } from '../utils/json';

// MCP Server for task management
export class TaskinfaMCPServer {
  private server: Server;
  private db: ReturnType<typeof getDb>;

  constructor() {
    this.server = new Server(
      {
        name: 'taskinfa-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.db = getDb();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_tasks':
            return await this.handleListTasks((args || {}) as unknown as ListTasksRequest);
          case 'get_task':
            return await this.handleGetTask((args || {}) as unknown as GetTaskRequest);
          case 'update_task_status':
            return await this.handleUpdateTaskStatus((args || {}) as unknown as UpdateTaskStatusRequest);
          case 'add_task_comment':
            return await this.handleAddComment((args || {}) as unknown as AddTaskCommentRequest);
          case 'list_task_comments':
            return await this.handleListComments((args || {}) as unknown as ListTaskCommentsRequest);
          case 'claim_task':
            return await this.handleClaimTask((args || {}) as unknown as ClaimTaskRequest);
          case 'create_task':
            return await this.handleCreateTask((args || {}) as unknown as CreateTaskRequest);
          case 'reorder_task':
            return await this.handleReorderTask((args || {}) as unknown as { task_id: string; status: TaskStatus; order: number });
          case 'list_task_lists':
            return await this.handleListTaskLists((args || {}) as unknown as { workspace_id: string });
          case 'get_task_list':
            return await this.handleGetTaskList((args || {}) as unknown as { task_list_id: string });
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'list_tasks',
        description:
          'List tasks filtered by workspace, task list (project), status, priority, or bot assignment. Returns tasks sorted by order within status column (top = highest priority).',
        inputSchema: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              description: 'Filter by workspace ID',
            },
            task_list_id: {
              type: 'string',
              description: 'Filter by task list (project) ID',
            },
            status: {
              type: 'string',
              enum: ['backlog', 'todo', 'in_progress', 'review', 'done'],
              description: 'Filter by task status',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Filter by priority level',
            },
            assigned_to: {
              type: ['string', 'null'],
              description: 'Filter by bot name. Use null to find unassigned tasks.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return (default: 50)',
              default: 50,
            },
          },
        },
      },
      {
        name: 'get_task',
        description: 'Get detailed information about a specific task by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'update_task_status',
        description:
          'Update task status and optionally add completion notes, files changed, error count, loop count, or bot assignment.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID',
            },
            status: {
              type: 'string',
              enum: ['backlog', 'todo', 'in_progress', 'review', 'done'],
              description: 'New task status',
            },
            completion_notes: {
              type: 'string',
              description: 'Notes about task completion or progress',
            },
            files_changed: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of files modified during task execution',
            },
            error_count: {
              type: 'number',
              description: 'Number of errors encountered',
            },
            loop_count: {
              type: 'number',
              description: 'Number of execution loops completed',
            },
            assigned_to: {
              type: 'string',
              description: 'Bot name to assign this task to',
            },
          },
          required: ['id', 'status'],
        },
      },
      {
        name: 'add_task_comment',
        description:
          'Add a comment to a task. Used by bots to log progress, questions, summaries, or errors.',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'Task ID to add comment to',
            },
            author: {
              type: 'string',
              description: 'Name of the author (bot name or "user")',
            },
            author_type: {
              type: 'string',
              enum: ['bot', 'user'],
              description: 'Type of author',
            },
            content: {
              type: 'string',
              description: 'Comment content',
            },
            comment_type: {
              type: 'string',
              enum: ['progress', 'question', 'summary', 'error'],
              description: 'Type of comment',
            },
            loop_number: {
              type: 'number',
              description: 'Execution loop number (optional)',
            },
          },
          required: ['task_id', 'author', 'author_type', 'content', 'comment_type'],
        },
      },
      {
        name: 'list_task_comments',
        description: 'List all comments for a specific task.',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'Task ID to get comments for',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of comments to return (default: 50)',
              default: 50,
            },
            offset: {
              type: 'number',
              description: 'Number of comments to skip (default: 0)',
              default: 0,
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'claim_task',
        description:
          'Atomically claim a task for a bot. Only succeeds if task is unassigned. Use this instead of update_task_status for initial assignment to avoid race conditions.',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'Task ID to claim',
            },
            bot_name: {
              type: 'string',
              description: 'Name of the bot claiming the task',
            },
          },
          required: ['task_id', 'bot_name'],
        },
      },
      {
        name: 'create_task',
        description:
          'Create a new task in a task list. The task is created in "backlog" status by default. Use reorder_task afterwards to place it in a specific position within a column.',
        inputSchema: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              description: 'Workspace ID',
            },
            task_list_id: {
              type: 'string',
              description: 'Task list (project) ID to create the task in',
            },
            title: {
              type: 'string',
              description: 'Task title (1-500 characters)',
            },
            description: {
              type: 'string',
              description: 'Task description (optional, max 5000 characters)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Task priority (default: medium)',
            },
            status: {
              type: 'string',
              enum: ['backlog', 'todo', 'in_progress', 'review', 'done'],
              description: 'Initial task status (default: backlog)',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels/tags for the task (optional)',
            },
          },
          required: ['workspace_id', 'task_list_id', 'title'],
        },
      },
      {
        name: 'reorder_task',
        description:
          'Move a task to a specific position within a status column. Order 0 = top of column. Other tasks in the column are shifted to make room.',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'Task ID to reorder',
            },
            status: {
              type: 'string',
              enum: ['backlog', 'todo', 'in_progress', 'review', 'done'],
              description: 'Target status column (can move task to a different column)',
            },
            order: {
              type: 'number',
              description: 'Target position within the column (0 = top)',
            },
          },
          required: ['task_id', 'status', 'order'],
        },
      },
      {
        name: 'list_task_lists',
        description:
          'List all task lists (projects) in a workspace. Each task list represents a project with its own repository and working directory.',
        inputSchema: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              description: 'Workspace ID to list task lists for',
            },
          },
          required: ['workspace_id'],
        },
      },
      {
        name: 'get_task_list',
        description:
          'Get detailed information about a specific task list (project), including repository URL and working directory for cloning and setup.',
        inputSchema: {
          type: 'object',
          properties: {
            task_list_id: {
              type: 'string',
              description: 'Task list ID',
            },
          },
          required: ['task_list_id'],
        },
      },
    ];
  }

  private async handleListTasks(args: ListTasksRequest) {
    const { workspace_id, task_list_id, status, priority, assigned_to, limit = 50 } = args;

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (workspace_id) {
      sql += ' AND workspace_id = ?';
      params.push(workspace_id);
    }

    if (task_list_id) {
      sql += ' AND task_list_id = ?';
      params.push(task_list_id);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    if (assigned_to !== undefined) {
      if (assigned_to === null) {
        sql += ' AND (assigned_to IS NULL OR assigned_to = "")';
      } else {
        sql += ' AND assigned_to = ?';
        params.push(assigned_to);
      }
    }

    // Order by position within status column (ascending), then creation date
    sql += ' ORDER BY "order" ASC, created_at ASC LIMIT ?';
    params.push(limit);

    const tasks = await query<Task>(this.db, sql, params);

    // Parse JSON fields
    const parsedTasks = tasks.map((task) => ({
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              tasks: parsedTasks,
              total: tasks.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetTask(args: GetTaskRequest) {
    const { id } = args;

    const task = await queryOne<Task>(this.db, 'SELECT * FROM tasks WHERE id = ?', [id]);

    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // Parse JSON fields
    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ task: parsedTask }, null, 2),
        },
      ],
    };
  }

  private async handleUpdateTaskStatus(args: UpdateTaskStatusRequest) {
    const { id, status, completion_notes, files_changed, error_count, loop_count, assigned_to } = args;

    // Build dynamic UPDATE query
    const updates: string[] = ['status = ?', 'updated_at = datetime("now")'];
    const params: any[] = [status];

    // Handle status-specific timestamps
    if (status === 'in_progress') {
      updates.push('started_at = COALESCE(started_at, datetime("now"))');
    } else if (status === 'done' || status === 'review') {
      updates.push('completed_at = COALESCE(completed_at, datetime("now"))');
    }

    if (completion_notes !== undefined) {
      updates.push('completion_notes = ?');
      params.push(completion_notes);
    }

    if (files_changed !== undefined) {
      updates.push('files_changed = ?');
      params.push(JSON.stringify(files_changed));
    }

    if (error_count !== undefined) {
      updates.push('error_count = ?');
      params.push(error_count);
    }

    if (loop_count !== undefined) {
      updates.push('loop_count = ?');
      params.push(loop_count);
    }

    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }

    params.push(id);

    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    await execute(this.db, sql, params);

    // Fetch updated task
    const task = await queryOne<Task>(this.db, 'SELECT * FROM tasks WHERE id = ?', [id]);

    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // Parse JSON fields
    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ task: parsedTask }, null, 2),
        },
      ],
    };
  }

  private async handleAddComment(args: AddTaskCommentRequest) {
    const { task_id, author, author_type, content, comment_type, loop_number } = args;

    // Generate comment ID
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Insert comment
    const sql = `
      INSERT INTO task_comments (id, task_id, author, author_type, content, comment_type, loop_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await execute(this.db, sql, [
      commentId,
      task_id,
      author,
      author_type,
      content,
      comment_type,
      loop_number || null,
    ]);

    // Fetch created comment
    const comment = await queryOne<TaskComment>(
      this.db,
      'SELECT * FROM task_comments WHERE id = ?',
      [commentId]
    );

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ comment }, null, 2),
        },
      ],
    };
  }

  private async handleListComments(args: ListTaskCommentsRequest) {
    const { task_id, limit = 50, offset = 0 } = args;

    // Query comments with pagination
    const comments = await query<TaskComment>(
      this.db,
      'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [task_id, limit, offset]
    );

    // Get total count
    const countResult = await queryOne<{ count: number }>(
      this.db,
      'SELECT COUNT(*) as count FROM task_comments WHERE task_id = ?',
      [task_id]
    );

    const total = countResult?.count || 0;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ comments, total }, null, 2),
        },
      ],
    };
  }

  private async handleClaimTask(args: ClaimTaskRequest) {
    const { task_id, bot_name } = args;

    // First, check if task exists and is unassigned
    const task = await queryOne<Task>(
      this.db,
      'SELECT * FROM tasks WHERE id = ?',
      [task_id]
    );

    if (!task) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Task not found: ${task_id}`,
            }, null, 2),
          },
        ],
      };
    }

    // Check if already assigned
    if (task.assigned_to && task.assigned_to !== '') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Task already assigned to ${task.assigned_to}`,
            }, null, 2),
          },
        ],
      };
    }

    // Attempt to claim the task atomically
    // Update task with assigned_to and status
    const result = await execute(
      this.db,
      `UPDATE tasks SET
        assigned_to = ?,
        status = ?,
        updated_at = datetime('now'),
        started_at = COALESCE(started_at, datetime('now'))
      WHERE id = ? AND (assigned_to IS NULL OR assigned_to = '')`,
      [bot_name, 'in_progress', task_id]
    );

    // Check if update was successful (only updates if task was unassigned)
    if (result.meta && result.meta.changes === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: 'Task was claimed by another bot',
            }, null, 2),
          },
        ],
      };
    }

    // Fetch updated task
    const updatedTask = await queryOne<Task>(
      this.db,
      'SELECT * FROM tasks WHERE id = ?',
      [task_id]
    );

    if (!updatedTask) {
      throw new Error('Failed to fetch updated task');
    }

    // Parse JSON fields
    const parsedTask = {
      ...updatedTask,
      labels: JSON.parse(updatedTask.labels as any),
      files_changed: JSON.parse(updatedTask.files_changed as any),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            task: parsedTask,
          }, null, 2),
        },
      ],
    };
  }

  private async handleCreateTask(args: CreateTaskRequest & { status?: TaskStatus }) {
    const { workspace_id, task_list_id, title, description, priority = 'medium', labels = [], status = 'backlog' } = args;

    if (!workspace_id) throw new Error('workspace_id is required');
    if (!task_list_id) throw new Error('task_list_id is required');
    if (!title || title.length === 0) throw new Error('title is required');
    if (title.length > 500) throw new Error('title must be 500 characters or less');
    if (description && description.length > 5000) throw new Error('description must be 5000 characters or less');

    // Verify task list exists and belongs to workspace
    const taskList = await queryOne<TaskList>(
      this.db,
      'SELECT id FROM task_lists WHERE id = ? AND workspace_id = ?',
      [task_list_id, workspace_id]
    );

    if (!taskList) {
      throw new Error(`Task list not found: ${task_list_id}`);
    }

    // Get next order number for target status column
    const maxOrderResult = await queryOne<{ max_order: number }>(
      this.db,
      'SELECT COALESCE(MAX("order"), -1) as max_order FROM tasks WHERE task_list_id = ? AND status = ?',
      [task_list_id, status]
    );

    const nextOrder = (maxOrderResult?.max_order ?? -1) + 1;

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await execute(
      this.db,
      `INSERT INTO tasks (id, workspace_id, task_list_id, title, description, priority, labels, status, "order")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        workspace_id,
        task_list_id,
        title,
        description || null,
        priority,
        JSON.stringify(labels),
        status,
        nextOrder,
      ]
    );

    // Fetch created task
    const task = await queryOne<Task>(this.db, 'SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      throw new Error('Failed to create task');
    }

    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ task: parsedTask }, null, 2),
        },
      ],
    };
  }

  private async handleReorderTask(args: { task_id: string; status: TaskStatus; order: number }) {
    const { task_id, status, order } = args;

    if (!task_id) throw new Error('task_id is required');
    if (!status) throw new Error('status is required');
    if (order === undefined || order < 0) throw new Error('order must be a non-negative number');

    // Verify task exists
    const task = await queryOne<Task>(this.db, 'SELECT * FROM tasks WHERE id = ?', [task_id]);

    if (!task) {
      throw new Error(`Task not found: ${task_id}`);
    }

    const taskListId = task.task_list_id;

    // Shift existing tasks at or after the target position to make room
    await execute(
      this.db,
      `UPDATE tasks SET "order" = "order" + 1, updated_at = datetime('now')
       WHERE task_list_id = ? AND status = ? AND "order" >= ? AND id != ?`,
      [taskListId, status, order, task_id]
    );

    // Build update for the moved task
    const updates: string[] = ['"order" = ?', 'status = ?', 'updated_at = datetime("now")'];
    const params: any[] = [order, status];

    // Handle status-specific timestamps
    if (status === 'in_progress' && task.status !== 'in_progress') {
      updates.push('started_at = COALESCE(started_at, datetime("now"))');
    } else if ((status === 'done' || status === 'review') && task.status !== 'done' && task.status !== 'review') {
      updates.push('completed_at = COALESCE(completed_at, datetime("now"))');
    }

    params.push(task_id);

    await execute(
      this.db,
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated task
    const updatedTask = await queryOne<Task>(this.db, 'SELECT * FROM tasks WHERE id = ?', [task_id]);

    if (!updatedTask) {
      throw new Error('Failed to fetch updated task');
    }

    const parsedTask = {
      ...updatedTask,
      labels: safeJsonParseArray<string>(updatedTask.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(updatedTask.files_changed as unknown as string, []),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ task: parsedTask }, null, 2),
        },
      ],
    };
  }

  private async handleListTaskLists(args: { workspace_id: string }) {
    const { workspace_id } = args;

    const taskLists = await query<TaskList>(
      this.db,
      'SELECT * FROM task_lists WHERE workspace_id = ? ORDER BY created_at DESC',
      [workspace_id]
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              task_lists: taskLists,
              total: taskLists.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetTaskList(args: { task_list_id: string }) {
    const { task_list_id } = args;

    const taskList = await queryOne<TaskList>(
      this.db,
      'SELECT * FROM task_lists WHERE id = ?',
      [task_list_id]
    );

    if (!taskList) {
      throw new Error(`Task list not found: ${task_list_id}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ task_list: taskList }, null, 2),
        },
      ],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Taskinfa MCP Server started on stdio');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new TaskinfaMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
