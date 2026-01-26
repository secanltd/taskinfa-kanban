// MCP Client for communicating with Taskinfa MCP Server
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type {
  Task,
  TaskComment,
  ListTasksRequest,
  GetTaskRequest,
  UpdateTaskStatusRequest,
  AddTaskCommentRequest,
  ListTaskCommentsRequest,
  ClaimTaskRequest,
} from '@taskinfa/shared';

export class TaskinfaMCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: 'taskinfa-bot-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(serverCommand: string, serverArgs: string[] = []): Promise<void> {
    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });

    await this.client.connect(this.transport);
    console.log('Connected to Taskinfa MCP Server');
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      this.transport = null;
    }
  }

  async listTasks(params: ListTasksRequest): Promise<{ tasks: Task[]; total: number }> {
    const result = await this.client.callTool({
      name: 'list_tasks',
      arguments: params as unknown as Record<string, unknown>,
    });

    if (result.isError) {
      const content = result.content as TextContent[];
      throw new Error(`Failed to list tasks: ${content[0]?.text}`);
    }

    const content = result.content as TextContent[];
    const data = JSON.parse(content[0]?.text || '{}');
    return data;
  }

  async getTask(taskId: string): Promise<Task> {
    const result = await this.client.callTool({
      name: 'get_task',
      arguments: { id: taskId } as Record<string, unknown>,
    });

    if (result.isError) {
      const content = result.content as TextContent[];
      throw new Error(`Failed to get task: ${content[0]?.text}`);
    }

    const content = result.content as TextContent[];
    const data = JSON.parse(content[0]?.text || '{}');
    return data.task;
  }

  async updateTaskStatus(params: UpdateTaskStatusRequest): Promise<Task> {
    const result = await this.client.callTool({
      name: 'update_task_status',
      arguments: params as unknown as Record<string, unknown>,
    });

    if (result.isError) {
      const content = result.content as TextContent[];
      throw new Error(`Failed to update task: ${content[0]?.text}`);
    }

    const content = result.content as TextContent[];
    const data = JSON.parse(content[0]?.text || '{}');
    return data.task;
  }

  async addComment(params: AddTaskCommentRequest): Promise<TaskComment> {
    const result = await this.client.callTool({
      name: 'add_task_comment',
      arguments: params as unknown as Record<string, unknown>,
    });

    if (result.isError) {
      const content = result.content as TextContent[];
      throw new Error(`Failed to add comment: ${content[0]?.text}`);
    }

    const content = result.content as TextContent[];
    const data = JSON.parse(content[0]?.text || '{}');
    return data.comment;
  }

  async listComments(params: ListTaskCommentsRequest): Promise<{ comments: TaskComment[]; total: number }> {
    const result = await this.client.callTool({
      name: 'list_task_comments',
      arguments: params as unknown as Record<string, unknown>,
    });

    if (result.isError) {
      const content = result.content as TextContent[];
      throw new Error(`Failed to list comments: ${content[0]?.text}`);
    }

    const content = result.content as TextContent[];
    const data = JSON.parse(content[0]?.text || '{}');
    return data;
  }

  async claimTask(params: ClaimTaskRequest): Promise<{ success: boolean; task?: Task; message?: string }> {
    const result = await this.client.callTool({
      name: 'claim_task',
      arguments: params as unknown as Record<string, unknown>,
    });

    if (result.isError) {
      const content = result.content as TextContent[];
      throw new Error(`Failed to claim task: ${content[0]?.text}`);
    }

    const content = result.content as TextContent[];
    const data = JSON.parse(content[0]?.text || '{}');
    return data;
  }
}
