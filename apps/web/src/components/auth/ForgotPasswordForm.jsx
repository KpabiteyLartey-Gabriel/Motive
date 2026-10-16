'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(identifier.trim());
      setSent(true);
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <p className="font-bold">Check your email and phone</p>
          <p className="mt-1 leading-relaxed">If an account exists for <strong>{identifier}</strong>, we have sent a password reset link. It expires in 60 minutes.</p>
        </div>
        <p className="text-sm leading-relaxed text-steel dark:text-neutral-400">
          Did not get it? Check your spam folder, wait a minute, then try again. For your security we show this same message whether or not the account exists.
        </p>
        <button type="button" onClick={() => setSent(false)} className="btn-primary w-full text-[15px]">Send another link</button>
        <p className="text-center text-sm"><Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Back to sign in</Link></p>
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
        <label htmlFor="identifier" className="label">Email or phone number</label>
        <input id="identifier" name="identifier" type="text" autoComplete="username" inputMode="email" required className="input" placeholder="you@example.com or +233 20 123 4567" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(''); }} />
        <p className="field-hint">Use the email or Ghana phone number you registered with.</p>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full text-[15px]" aria-busy={loading}>
        {loading ? <><span className="spinner" aria-hidden="true" /> Sending reset link…</> : 'Send reset link'}
      </button>
      <p className="text-center text-[13px] text-steel dark:text-neutral-400">We will email and text you the same secure link. It expires in 60 minutes.</p>
    </form>
  );
}
