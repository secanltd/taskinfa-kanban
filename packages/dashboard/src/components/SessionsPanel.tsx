'use client';

import type { SessionWithDetails, SessionStatus } from '@taskinfa/shared';

interface SessionsPanelProps {
  sessions: SessionWithDetails[];
  connected: boolean;
  stats: {
    active: number;
    idle: number;
    stuck: number;
    completed: number;
    error: number;
  };
  onReconnect?: () => void;
}

export default function SessionsPanel({
  sessions,
  connected,
  stats,
  onReconnect,
}: SessionsPanelProps) {
  const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'idle');
  const problemSessions = sessions.filter(s => s.status === 'stuck' || s.status === 'error');

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'active': return 'bg-terminal-blue';
      case 'idle': return 'bg-terminal-green';
      case 'stuck': return 'bg-terminal-amber';
      case 'error': return 'bg-terminal-red';
      case 'completed': return 'bg-terminal-muted';
    }
  };

  const getStatusLabel = (status: SessionStatus) => {
    switch (status) {
      case 'active': return 'Working';
      case 'idle': return 'Idle';
      case 'stuck': return 'Stuck';
      case 'error': return 'Error';
      case 'completed': return 'Done';
    }
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-terminal-text">Sessions</h3>
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-terminal-green animate-pulse' : 'bg-terminal-red'
            }`}
          />
        </div>
        {!connected && onReconnect && (
          <button
            onClick={onReconnect}
            className="text-xs text-terminal-blue hover:text-terminal-text underline"
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-terminal-border">
        <div className="bg-terminal-blue/10 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-terminal-blue">{stats.active}</div>
          <div className="text-xs text-terminal-blue/80">Active</div>
        </div>
        <div className="bg-terminal-amber/10 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-terminal-amber">{stats.stuck}</div>
          <div className="text-xs text-terminal-amber/80">Stuck</div>
        </div>
        <div className="bg-terminal-green/10 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-terminal-green">{stats.completed}</div>
          <div className="text-xs text-terminal-green/80">Done</div>
        </div>
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="text-center text-terminal-muted text-sm py-8">
          No active sessions
        </div>
      ) : (
        <div className="divide-y divide-terminal-border max-h-[300px] sm:max-h-[400px] overflow-y-auto scrollbar-thin">
          {/* Active/problem sessions first */}
          {[...activeSessions, ...problemSessions].map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 p-3 hover:bg-terminal-surface-hover transition-colors"
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusColor(session.status)}${
                session.status === 'active' ? ' animate-pulse' : ''
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-terminal-text text-sm truncate">
                    {session.project_name || 'Unknown Project'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    session.status === 'active' ? 'bg-terminal-blue/20 text-terminal-blue' :
                    session.status === 'stuck' ? 'bg-terminal-amber/20 text-terminal-amber' :
                    session.status === 'error' ? 'bg-terminal-red/20 text-terminal-red' :
                    'bg-terminal-muted/20 text-terminal-muted'
                  }`}>
                    {getStatusLabel(session.status)}
                  </span>
                </div>
                {session.current_task_title && (
                  <div className="text-xs text-terminal-muted truncate mt-0.5">
                    {session.current_task_title}
                  </div>
                )}
                {session.summary && !session.current_task_title && (
                  <div className="text-xs text-terminal-muted truncate mt-0.5">
                    {session.summary}
                  </div>
                )}
              </div>
              <span className="text-xs text-terminal-muted flex-shrink-0">
                {formatTimeAgo(session.last_event_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
