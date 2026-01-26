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
  ListTasksRequest,
  GetTaskRequest,
  UpdateTaskStatusRequest,
  TaskStatus,
} from '@taskinfa/shared';
import { getDb, query, queryOne, execute } from '../db/client';

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
          'List tasks filtered by workspace, status, or priority. Returns tasks sorted by creation date (newest first).',
        inputSchema: {
          type: 'object',
          properties: {
            workspace_id: {
              type: 'string',
              description: 'Filter by workspace ID',
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
          'Update task status and optionally add completion notes, files changed, error count, or loop count.',
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
          },
          required: ['id', 'status'],
        },
      },
    ];
  }

  private async handleListTasks(args: ListTasksRequest) {
    const { workspace_id, status, priority, limit = 50 } = args;

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (workspace_id) {
      sql += ' AND workspace_id = ?';
      params.push(workspace_id);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const tasks = await query<Task>(this.db, sql, params);

    // Parse JSON fields
    const parsedTasks = tasks.map((task) => ({
      ...task,
      labels: JSON.parse(task.labels as any),
      files_changed: JSON.parse(task.files_changed as any),
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
      labels: JSON.parse(task.labels as any),
      files_changed: JSON.parse(task.files_changed as any),
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
    const { id, status, completion_notes, files_changed, error_count, loop_count } = args;

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
      labels: JSON.parse(task.labels as any),
      files_changed: JSON.parse(task.files_changed as any),
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
