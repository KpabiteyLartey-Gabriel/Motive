'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="space-y-5">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          This page needs a reset link. Open the link we sent to your email or phone, or request a new one.
        </div>
        <Link href="/forgot-password" className="btn-primary block w-full text-center text-[15px]">Request a reset link</Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) { setError('Your new password must be at least 8 characters.'); return; }
    if (form.newPassword !== form.confirm) { setError('The two passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword(token, form.newPassword);
      setDone(true);
    } catch (err) {
      const message = err.response?.data?.message || 'This reset link is invalid or has expired. Request a new one.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <p className="font-bold">Password changed</p>
          <p className="mt-1 leading-relaxed">Your password has been reset and all other sessions were signed out. We also sent you a confirmation by email and SMS.</p>
        </div>
        <button type="button" onClick={() => router.push('/login')} className="btn-primary w-full text-[15px]">Sign in with new password</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span aria-hidden="true" className="font-bold">!</span><span>{error}</span>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="newPassword" className="label">New password</label>
          <button type="button" onClick={() => setShow((v) => !v)} className="mb-1.5 text-[13px] font-semibold text-brand-700 hover:underline dark:text-brand-300">{show ? 'Hide' : 'Show'}</button>
        </div>
        <input id="newPassword" name="newPassword" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} className="input" placeholder="At least 8 characters" value={form.newPassword} onChange={(e) => { setForm((p) => ({ ...p, newPassword: e.target.value })); setError(''); }} />
        <p className="field-hint">Use at least 8 characters. Mix letters, numbers and a symbol for strength.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <input id="confirm" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required className="input" placeholder="Repeat the new password" value={form.confirm} onChange={(e) => { setForm((p) => ({ ...p, confirm: e.target.value })); setError(''); }} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full text-[15px]" aria-busy={loading}>
        {loading ? <><span className="spinner" aria-hidden="true" /> Resetting password…</> : 'Reset password'}
      </button>
    </form>
  );
}
