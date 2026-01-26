// Task Executor - Main loop logic inspired by Ralph
// Implements dual-condition exit detection and circuit breaker

import type { Task, ExecutionContext } from '@taskinfa/shared';
import { TaskinfaMCPClient } from '../client/mcp-client.js';
import { ClaudeCodeRunner } from '../claude/runner.js';
import chalk from 'chalk';

export interface ExecutorConfig {
  workspaceId: string;
  mcpServerCommand: string;
  mcpServerArgs?: string[];
  workingDir?: string;
  maxLoops?: number;
  circuitBreakerThreshold?: number;
  noProgressLoops?: number;
}

export class TaskExecutor {
  private mcpClient: TaskinfaMCPClient;
  private claudeRunner: ClaudeCodeRunner;
  private config: ExecutorConfig;

  constructor(config: ExecutorConfig) {
    this.config = {
      maxLoops: 50,
      circuitBreakerThreshold: 5,
      noProgressLoops: 3,
      ...config,
    };
    this.mcpClient = new TaskinfaMCPClient();
    this.claudeRunner = new ClaudeCodeRunner();
  }

  async start(): Promise<void> {
    console.log(chalk.blue('Starting Taskinfa Bot...'));
    console.log(chalk.gray(`Workspace: ${this.config.workspaceId}`));
    console.log(chalk.gray(`Max loops per task: ${this.config.maxLoops}`));
    console.log();

    // Connect to MCP server
    await this.mcpClient.connect(this.config.mcpServerCommand, this.config.mcpServerArgs);

    try {
      // Main loop: fetch and execute tasks
      while (true) {
        const task = await this.fetchNextTask();

        if (!task) {
          console.log(chalk.yellow('No tasks available. Exiting...'));
          break;
        }

        await this.executeTask(task);
      }
    } finally {
      await this.mcpClient.disconnect();
    }
  }

  private async fetchNextTask(): Promise<Task | null> {
    console.log(chalk.blue('Fetching next task...'));

    const { tasks } = await this.mcpClient.listTasks({
      workspace_id: this.config.workspaceId,
      status: 'todo',
      limit: 1,
    });

    return tasks[0] || null;
  }

  private async executeTask(task: Task): Promise<void> {
    console.log();
    console.log(chalk.green.bold(`Executing Task: ${task.title}`));
    console.log(chalk.gray(`ID: ${task.id}`));
    console.log(chalk.gray(`Priority: ${task.priority}`));
    if (task.description) {
      console.log(chalk.gray(`Description: ${task.description}`));
    }
    console.log();

    // Update status to in_progress
    await this.mcpClient.updateTaskStatus({
      id: task.id,
      status: 'in_progress',
    });

    const context: ExecutionContext = {
      task,
      loopCount: 0,
      errorCount: 0,
      filesChanged: new Set(),
      lastProgress: 0,
    };

    let sessionId: string | undefined;
    let completionIndicatorsTotal = 0;
    let hasExitSignal = false;

    // Main execution loop
    while (context.loopCount < this.config.maxLoops!) {
      context.loopCount++;

      console.log(chalk.cyan(`\n--- Loop ${context.loopCount}/${this.config.maxLoops} ---`));

      // Check circuit breaker
      if (this.shouldBreakCircuit(context)) {
        console.log(chalk.red('Circuit breaker activated: no progress detected'));
        await this.completeTask(task, context, 'Circuit breaker: No progress after multiple loops');
        return;
      }

      try {
        // Build prompt for Claude Code
        const prompt = this.buildPrompt(task, context);

        // Run Claude Code
        const output = await this.claudeRunner.run(prompt, {
          workingDir: this.config.workingDir,
          sessionId,
          continueSession: context.loopCount > 1,
        });

        // Track files changed
        const previousFileCount = context.filesChanged.size;
        output.filesModified.forEach((file) => context.filesChanged.add(file));

        // Update progress indicator
        if (context.filesChanged.size > previousFileCount) {
          context.lastProgress = context.loopCount;
        }

        // Accumulate completion indicators
        completionIndicatorsTotal += output.completionIndicators;
        hasExitSignal = output.exitSignal;

        console.log(chalk.gray(`Completion indicators: ${completionIndicatorsTotal}`));
        console.log(chalk.gray(`Exit signal: ${hasExitSignal}`));
        console.log(chalk.gray(`Files changed: ${context.filesChanged.size}`));

        // Ralph-style dual-condition exit detection
        if (this.shouldExit(completionIndicatorsTotal, hasExitSignal)) {
          console.log(chalk.green.bold('\n✓ Task completed successfully!'));
          await this.completeTask(
            task,
            context,
            'Task completed: Exit conditions met (indicators + signal)'
          );
          return;
        }

        // Track errors
        if (output.errors.length > 0) {
          context.errorCount += output.errors.length;
          console.log(chalk.yellow(`Errors encountered: ${output.errors.length}`));

          if (context.errorCount >= this.config.circuitBreakerThreshold!) {
            console.log(chalk.red('Circuit breaker: Too many errors'));
            await this.completeTask(task, context, 'Circuit breaker: Error threshold exceeded');
            return;
          }
        }
      } catch (error) {
        context.errorCount++;
        console.error(chalk.red('Error during execution:'), error);

        if (context.errorCount >= this.config.circuitBreakerThreshold!) {
          console.log(chalk.red('Circuit breaker: Too many execution errors'));
          await this.completeTask(
            task,
            context,
            `Circuit breaker: Error - ${error instanceof Error ? error.message : String(error)}`
          );
          return;
        }
      }
    }

    // Max loops reached
    console.log(chalk.yellow('\nMax loops reached without completion'));
    await this.completeTask(task, context, 'Max loops reached without clear completion signal');
  }

  private buildPrompt(task: Task, context: ExecutionContext): string {
    let prompt = '';

    if (context.loopCount === 1) {
      // First loop: provide full task details
      prompt = `Please complete the following task:\n\n`;
      prompt += `Title: ${task.title}\n`;
      if (task.description) {
        prompt += `Description: ${task.description}\n`;
      }
      prompt += `Priority: ${task.priority}\n\n`;
      prompt += `IMPORTANT: When the task is complete, output a status block like this:\n`;
      prompt += `RALPH_STATUS: {"EXIT_SIGNAL": true, "COMPLETION_INDICATORS": 2}\n`;
    } else {
      // Continuation loops
      prompt = `Continue working on the task. `;
      prompt += `Progress: ${context.filesChanged.size} files changed so far. `;
      prompt += `When complete, output the RALPH_STATUS block.`;
    }

    return prompt;
  }

  private shouldExit(completionIndicators: number, hasExitSignal: boolean): boolean {
    // Ralph-style dual-condition:
    // Requires ≥2 completion indicators AND explicit EXIT_SIGNAL
    return completionIndicators >= 2 && hasExitSignal;
  }

  private shouldBreakCircuit(context: ExecutionContext): boolean {
    // Break if no progress (file changes) for N loops
    const loopsSinceProgress = context.loopCount - context.lastProgress;
    return loopsSinceProgress >= this.config.noProgressLoops!;
  }

  private async completeTask(
    task: Task,
    context: ExecutionContext,
    completionNotes: string
  ): Promise<void> {
    // Update task to review status
    await this.mcpClient.updateTaskStatus({
      id: task.id,
      status: 'review',
      completion_notes: completionNotes,
      files_changed: Array.from(context.filesChanged),
      error_count: context.errorCount,
      loop_count: context.loopCount,
    });

    console.log(chalk.blue('\nTask Status:'));
    console.log(chalk.gray(`  Status: review`));
    console.log(chalk.gray(`  Loops: ${context.loopCount}`));
    console.log(chalk.gray(`  Errors: ${context.errorCount}`));
    console.log(chalk.gray(`  Files changed: ${context.filesChanged.size}`));
    console.log(chalk.gray(`  Notes: ${completionNotes}`));
  }
}
