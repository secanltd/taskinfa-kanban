// MCP Client for communicating with Taskinfa MCP Server
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  Task,
  ListTasksRequest,
  GetTaskRequest,
  UpdateTaskStatusRequest,
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
      arguments: params,
    });

    if (result.isError) {
      throw new Error(`Failed to list tasks: ${result.content[0]?.text}`);
    }

    const data = JSON.parse(result.content[0]?.text || '{}');
    return data;
  }

  async getTask(taskId: string): Promise<Task> {
    const result = await this.client.callTool({
      name: 'get_task',
      arguments: { id: taskId } satisfies GetTaskRequest,
    });

    if (result.isError) {
      throw new Error(`Failed to get task: ${result.content[0]?.text}`);
    }

    const data = JSON.parse(result.content[0]?.text || '{}');
    return data.task;
  }

  async updateTaskStatus(params: UpdateTaskStatusRequest): Promise<Task> {
    const result = await this.client.callTool({
      name: 'update_task_status',
      arguments: params,
    });

    if (result.isError) {
      throw new Error(`Failed to update task: ${result.content[0]?.text}`);
    }

    const data = JSON.parse(result.content[0]?.text || '{}');
    return data.task;
  }
}
