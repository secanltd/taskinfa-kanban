// Claude Code CLI Runner
// Spawns and manages Claude Code processes

import { spawn } from 'child_process';
import type { ClaudeCodeOutput } from '@taskinfa/shared';

export interface ClaudeRunnerOptions {
  workingDir?: string;
  sessionId?: string;
  continueSession?: boolean;
  timeout?: number; // milliseconds
}

export class ClaudeCodeRunner {
  private process: any = null;

  async run(prompt: string, options: ClaudeRunnerOptions = {}): Promise<ClaudeCodeOutput> {
    const {
      workingDir = process.cwd(),
      sessionId,
      continueSession = false,
      timeout = 300000, // 5 minutes default
    } = options;

    return new Promise((resolve, reject) => {
      const args = ['code', prompt];

      // Add --continue flag for session continuity
      if (continueSession && sessionId) {
        args.push('--continue', sessionId);
      }

      // Add working directory
      if (workingDir) {
        args.push('--cwd', workingDir);
      }

      // Spawn Claude Code process
      this.process = spawn('claude', args, {
        cwd: workingDir,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        if (this.process) {
          this.process.kill('SIGTERM');
        }
      }, timeout);

      // Capture stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        process.stdout.write(chunk); // Echo to console
      });

      // Capture stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        process.stderr.write(chunk); // Echo to console
      });

      // Handle process completion
      this.process.on('close', (code: number) => {
        clearTimeout(timer);

        if (timedOut) {
          reject(new Error('Claude Code execution timed out'));
          return;
        }

        if (code !== 0 && code !== null) {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
          return;
        }

        // Parse output
        const output = this.parseOutput(stdout, stderr);
        resolve(output);
      });

      // Handle process errors
      this.process.on('error', (error: Error) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
      });
    });
  }

  private parseOutput(stdout: string, stderr: string): ClaudeCodeOutput {
    const output: ClaudeCodeOutput = {
      text: stdout,
      exitSignal: false,
      completionIndicators: 0,
      filesModified: [],
      errors: [],
    };

    // Look for RALPH_STATUS block (Ralph-style exit detection)
    const ralphStatusMatch = stdout.match(/RALPH_STATUS:\s*({[\s\S]*?})/);
    if (ralphStatusMatch) {
      try {
        const status = JSON.parse(ralphStatusMatch[1]);
        output.exitSignal = status.EXIT_SIGNAL === true;
        output.completionIndicators = status.COMPLETION_INDICATORS || 0;
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Count completion indicators in text
    const completionPhrases = [
      /task\s+(?:is\s+)?complete/i,
      /successfully\s+completed/i,
      /finished\s+(?:the\s+)?task/i,
      /done\s+with\s+(?:the\s+)?task/i,
      /implementation\s+complete/i,
    ];

    for (const phrase of completionPhrases) {
      if (phrase.test(stdout)) {
        output.completionIndicators++;
      }
    }

    // Extract files modified
    const fileMatches = stdout.matchAll(/(?:modified|created|updated|edited):\s*([^\s\n]+)/gi);
    for (const match of fileMatches) {
      if (match[1]) {
        output.filesModified.push(match[1]);
      }
    }

    // Extract errors from stderr
    if (stderr) {
      const errorLines = stderr.split('\n').filter((line) => line.includes('error'));
      output.errors = errorLines;
    }

    return output;
  }

  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
