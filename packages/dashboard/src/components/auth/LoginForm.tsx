'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json() as { error?: string };

      if (!response.ok) {
        setErrors({ general: data.error || 'Login failed' });
        return;
      }

      // Redirect to dashboard on success
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setErrors({ general: 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="card px-8 py-10">
        <h2 className="text-2xl font-bold text-terminal-text mb-6 text-center">
          Log in to Kanban
        </h2>

        {errors.general && (
          <div className="mb-4 p-3 bg-terminal-red/10 border border-terminal-red/20 rounded-lg">
            <p className="text-sm text-terminal-red">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-terminal-muted mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`input-field w-full ${
                errors.email ? 'border-terminal-red focus:ring-terminal-red' : ''
              }`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-terminal-red">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-terminal-muted mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={`input-field w-full ${
                errors.password ? 'border-terminal-red focus:ring-terminal-red' : ''
              }`}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-terminal-red">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`btn-primary w-full ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-terminal-muted">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-medium text-terminal-green hover:text-green-400 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
