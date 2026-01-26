import SignupForm from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Taskinfa</h1>
          <p className="text-gray-600 text-sm mt-1">
            Autonomous task automation with Claude Code
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <SignupForm />
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Developed by <span className="font-semibold">SECAN</span> • Open Source MIT License
        </div>
      </footer>
    </div>
  );
}
