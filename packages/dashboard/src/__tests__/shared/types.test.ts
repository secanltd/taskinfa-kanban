import { describe, it, expect } from 'vitest';
import type {
  TaskStatus,
  TaskPriority,
  Task,
  User,
  Workspace,
  ApiKey,
  Session,
  SessionEvent,
  TaskFilters,
  SavedFilter,
  LoginRequest,
  SignupRequest,
  CreateTaskRequest,
  CreateEventRequest,
} from '@taskinfa/shared';

describe('Shared Types', () => {
  describe('TaskStatus type', () => {
    it('should accept valid task statuses', () => {
      const statuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain('backlog');
      expect(statuses).toContain('done');
    });
  });

  describe('TaskPriority type', () => {
    it('should accept valid priorities', () => {
      const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
      expect(priorities).toHaveLength(4);
    });
  });

  describe('Task interface', () => {
    it('should match expected shape', () => {
      const task: Task = {
        id: 'task_123',
        workspace_id: 'ws_456',
        task_list_id: 'tl_789',
        title: 'Test task',
        description: 'A test task',
        status: 'todo',
        priority: 'medium',
        labels: ['bug', 'frontend'],
        assignee: null,
        assigned_to: null,
        order: 0,
        loop_count: 0,
        error_count: 0,
        files_changed: [],
        completion_notes: null,
        pr_url: null,
        branch_name: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        started_at: null,
        completed_at: null,
      };

      expect(task.id).toBe('task_123');
      expect(task.status).toBe('todo');
      expect(task.labels).toEqual(['bug', 'frontend']);
    });
  });

  describe('User interface', () => {
    it('should match expected shape', () => {
      const user: User = {
        id: 'user_123',
        email: 'test@example.com',
        password_hash: '$2b$12$...',
        name: 'Test User',
        workspace_id: 'ws_456',
        is_verified: false,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        last_login_at: null,
      };

      expect(user.email).toBe('test@example.com');
      expect(user.is_active).toBe(true);
    });
  });

  describe('TaskFilters interface', () => {
    it('should accept partial filter objects', () => {
      const filters: TaskFilters = {
        q: 'search term',
        status: 'todo',
        priority: 'high',
        sort: 'created_at',
        order: 'desc',
      };

      expect(filters.q).toBe('search term');
      expect(filters.status).toBe('todo');
    });

    it('should accept empty filters', () => {
      const filters: TaskFilters = {};
      expect(Object.keys(filters)).toHaveLength(0);
    });
  });

  describe('Request types', () => {
    it('LoginRequest should have email and password', () => {
      const req: LoginRequest = { email: 'test@example.com', password: 'Test1234' };
      expect(req.email).toBeDefined();
      expect(req.password).toBeDefined();
    });

    it('SignupRequest should have email, password, and optional name', () => {
      const req: SignupRequest = { email: 'test@example.com', password: 'Test1234', name: 'User' };
      expect(req.name).toBe('User');
    });

    it('CreateTaskRequest should have required fields', () => {
      const req: CreateTaskRequest = {
        workspace_id: 'ws_1',
        task_list_id: 'tl_1',
        title: 'New task',
        priority: 'high',
        labels: ['feature'],
      };
      expect(req.title).toBe('New task');
    });

    it('CreateEventRequest should have event_type', () => {
      const req: CreateEventRequest = {
        event_type: 'task_completed',
        task_id: 'task_1',
        message: 'Done!',
      };
      expect(req.event_type).toBe('task_completed');
    });
  });
});
