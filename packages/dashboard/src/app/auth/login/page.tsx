import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-terminal-bg flex flex-col">
      <header className="bg-terminal-surface border-b border-terminal-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-2xl font-bold text-terminal-text">Taskinfa</h1>
          </div>
          <p className="text-terminal-muted text-sm mt-1">
            Autonomous task automation with Claude Code
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <LoginForm />
      </main>

      <footer className="bg-terminal-surface border-t border-terminal-border">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-terminal-muted text-sm">
          Developed by <span className="font-semibold text-terminal-text">SECAN</span> • Open Source MIT License
        </div>
      </footer>
    </div>
  );
}
