#!/usr/bin/env node

// Taskinfa-Bot CLI Entry Point
import { program } from 'commander';
import { config } from 'dotenv';
import { TaskExecutor } from './loop/executor.js';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('taskinfa-bot')
  .description('Autonomous task automation bot for Claude Code')
  .version('1.0.0');

program
  .command('run')
  .description('Start the task execution loop')
  .option('-w, --workspace <id>', 'Workspace ID', 'default')
  .option('--name <name>', 'Bot name', 'Bot-John')
  .option('-d, --dir <path>', 'Working directory', process.cwd())
  .option('-s, --server <command>', 'MCP server command', 'node')
  .option('-a, --args <args>', 'MCP server arguments', 'packages/dashboard/dist/lib/mcp/server.js')
  .option('-m, --max-loops <number>', 'Max loops per task', '50')
  .option('-c, --circuit-breaker <number>', 'Circuit breaker error threshold', '5')
  .option('-n, --no-progress <number>', 'No progress loop threshold', '3')
  .action(async (options) => {
    console.log(chalk.blue.bold('Taskinfa-Bot v1.0.0'));
    console.log(chalk.gray('Autonomous Task Automation for Claude Code'));
    console.log();

    try {
      const executor = new TaskExecutor({
        workspaceId: options.workspace,
        botName: options.name,
        mcpServerCommand: options.server,
        mcpServerArgs: options.args.split(' '),
        workingDir: options.dir,
        maxLoops: parseInt(options.maxLoops),
        circuitBreakerThreshold: parseInt(options.circuitBreaker),
        noProgressLoops: parseInt(options.noProgress),
      });

      await executor.start();
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Display version information')
  .action(() => {
    console.log(chalk.blue('Taskinfa-Bot v1.0.0'));
    console.log(chalk.gray('Developed by SECAN'));
    console.log(chalk.gray('Licensed under MIT'));
  });

program.parse();
