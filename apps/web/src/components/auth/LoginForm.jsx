'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { resolvePostAuthPath, storeAuth } from '@/lib/onboarding';
import GoogleButton from '@/components/auth/GoogleButton';

export default function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authApi.login(form);
      const data = response.data.data;
      storeAuth(data);
      router.push(await resolvePostAuthPath(data.user));
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials and try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <GoogleButton label="Continue with Google" />
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line dark:bg-dark-border" />
        <span className="text-xs font-medium text-steel dark:text-neutral-400">or sign in with email</span>
        <span className="h-px flex-1 bg-line dark:bg-dark-border" />
      </div>
    <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span aria-hidden="true" className="font-bold">!</span><span>{error}</span>
        </div>
      )}
      <div>
        <label htmlFor="identifier" className="label">Email</label>
        <input id="identifier" name="identifier" type="text" autoComplete="username" inputMode="email" required className="input" placeholder="e.g. you@example.com" value={form.identifier} onChange={handleChange} aria-invalid={!!error} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-[13px] font-bold text-brand-700 hover:underline dark:text-brand-300">Forgot Password?</Link>
        </div>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required className="input pr-20" placeholder="Enter your password" value={form.password} onChange={handleChange} />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-1.5 top-1/2 flex min-h-[36px] -translate-y-1/2 items-center rounded-lg px-3 text-[13px] font-semibold text-steel hover:bg-mist hover:text-ink dark:text-neutral-300 dark:hover:bg-dark-elevated" aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full text-[15px]" aria-busy={loading}>
        {loading ? <><span className="spinner" aria-hidden="true" /> Signing you in…</> : <>Sign In <span aria-hidden="true">→</span></>}
      </button>
    </form>
    </div>
  );
}
