import { describe, it, expect } from 'vitest';

// Test orchestrator pure functions extracted for testing
// Since orchestrator.ts has side effects on import, we test the logic patterns it uses

describe('Orchestrator Logic', () => {
  describe('Priority sorting', () => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

    function sortByPriority(tasks: { priority: string }[]) {
      return [...tasks].sort(
        (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );
    }

    it('should sort urgent tasks first', () => {
      const tasks = [
        { priority: 'low' },
        { priority: 'urgent' },
        { priority: 'medium' },
        { priority: 'high' },
      ];
      const sorted = sortByPriority(tasks);
      expect(sorted[0].priority).toBe('urgent');
      expect(sorted[1].priority).toBe('high');
      expect(sorted[2].priority).toBe('medium');
      expect(sorted[3].priority).toBe('low');
    });

    it('should handle unknown priorities as medium', () => {
      const tasks = [
        { priority: 'unknown' },
        { priority: 'urgent' },
      ];
      const sorted = sortByPriority(tasks);
      expect(sorted[0].priority).toBe('urgent');
    });
  });

  describe('Branch name generation', () => {
    function generateBranchName(task: { id: string; title: string }): string {
      const taskIdShort = task.id.replace('task_', '').slice(0, 8);
      const titleSlug = task.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      return `task/${taskIdShort}/${titleSlug}`;
    }

    it('should generate valid branch names', () => {
      const branch = generateBranchName({
        id: 'task_abc12345xyz',
        title: 'Add user authentication',
      });
      expect(branch).toBe('task/abc12345/add-user-authentication');
    });

    it('should handle special characters in titles', () => {
      const branch = generateBranchName({
        id: 'task_123',
        title: 'Fix bug: API endpoint returns 500 error!',
      });
      expect(branch).toBe('task/123/fix-bug-api-endpoint-returns-500-error');
    });

    it('should truncate long titles', () => {
      const branch = generateBranchName({
        id: 'task_xyz',
        title: 'This is a very long task title that should be truncated to fit within the branch name limit',
      });
      expect(branch.length).toBeLessThanOrEqual(60);
    });

    it('should strip task_ prefix from ID', () => {
      const branch = generateBranchName({ id: 'task_abcdef', title: 'test' });
      expect(branch).toBe('task/abcdef/test');
    });
  });

  describe('SSH URL to HTTPS conversion', () => {
    function toHttpsUrl(repoUrl: string): string {
      const sshMatch = repoUrl.match(/^git@github\.com:(.+)$/);
      if (sshMatch) return `https://github.com/${sshMatch[1]}`;
      const sshProtoMatch = repoUrl.match(/^ssh:\/\/git@github\.com\/(.+)$/);
      if (sshProtoMatch) return `https://github.com/${sshProtoMatch[1]}`;
      return repoUrl;
    }

    it('should convert git@ SSH URLs to HTTPS', () => {
      expect(toHttpsUrl('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo.git');
    });

    it('should convert ssh:// URLs to HTTPS', () => {
      expect(toHttpsUrl('ssh://git@github.com/owner/repo')).toBe('https://github.com/owner/repo');
    });

    it('should return HTTPS URLs unchanged', () => {
      expect(toHttpsUrl('https://github.com/owner/repo')).toBe('https://github.com/owner/repo');
    });
  });

  describe('Task grouping by project', () => {
    interface Task {
      id: string;
      task_list_id: string | null;
    }

    function groupByProject(tasks: Task[]): Map<string, Task[]> {
      const grouped = new Map<string, Task[]>();
      for (const task of tasks) {
        const projectId = task.task_list_id || 'default';
        if (!grouped.has(projectId)) grouped.set(projectId, []);
        grouped.get(projectId)!.push(task);
      }
      return grouped;
    }

    it('should group tasks by project', () => {
      const tasks = [
        { id: '1', task_list_id: 'proj_a' },
        { id: '2', task_list_id: 'proj_b' },
        { id: '3', task_list_id: 'proj_a' },
      ];
      const grouped = groupByProject(tasks);
      expect(grouped.get('proj_a')?.length).toBe(2);
      expect(grouped.get('proj_b')?.length).toBe(1);
    });

    it('should use default for tasks without project', () => {
      const tasks = [
        { id: '1', task_list_id: null },
      ];
      const grouped = groupByProject(tasks);
      expect(grouped.get('default')?.length).toBe(1);
    });

    it('should handle empty task list', () => {
      const grouped = groupByProject([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe('Config parsing', () => {
    function parseConfigLine(line: string): [string, string] | null {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return null;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return null;
      return [trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1)];
    }

    it('should parse key=value lines', () => {
      expect(parseConfigLine('KEY=value')).toEqual(['KEY', 'value']);
      expect(parseConfigLine('API_URL=http://localhost:3000')).toEqual(['API_URL', 'http://localhost:3000']);
    });

    it('should handle values with = signs', () => {
      expect(parseConfigLine('SECRET=abc=def')).toEqual(['SECRET', 'abc=def']);
    });

    it('should skip comments', () => {
      expect(parseConfigLine('# This is a comment')).toBeNull();
    });

    it('should skip empty lines', () => {
      expect(parseConfigLine('')).toBeNull();
      expect(parseConfigLine('  ')).toBeNull();
    });

    it('should skip lines without =', () => {
      expect(parseConfigLine('no equals here')).toBeNull();
    });
  });
});
