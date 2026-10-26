'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingShell from '@/components/auth/OnboardingShell';
import { usersApi } from '@/lib/api';
import { resolvePostAuthPath } from '@/lib/onboarding';

const STEPS = [
  { key: 'account', label: 'Create account', status: 'done' },
  { key: 'verify', label: 'Verify email', status: 'current' },
  { key: 'portal', label: 'Portal', status: 'todo' },
];

export default function VerifyEmailPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem('gh_motive_access_token')) { router.replace('/login'); return; }
    try {
      const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
      if (stored.emailVerifiedAt) { router.replace('/portal'); return; }
      if (!stored.email) { router.replace('/portal'); return; }
      setUser(stored);
    } catch { router.replace('/login'); }
  }, [router]);

  const sendCode = useCallback(async (quiet = false) => {
    setBusy('send'); setError('');
    try {
      const res = await usersApi.sendEmailCode();
      const data = res.data?.data || res.data;
      if (data?.alreadyVerified) { router.replace('/portal'); return; }
      if (!quiet) setNotice('A new code has been sent to your email.');
      setCooldown(60);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not send the code. Please try again.';
      setError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally { setBusy(''); }
  }, [router]);

  // The signup already sent one code; resend only if the user asks.
  useEffect(() => {
    if (!user || sentOnce.current) return;
    sentOnce.current = true;
  }, [user]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async () => {
    setBusy('verify'); setError(''); setNotice('');
    try {
      await usersApi.confirmEmailCode(code.trim());
      const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
      const updated = { ...stored, emailVerifiedAt: new Date().toISOString() };
      localStorage.setItem('gh_motive_user', JSON.stringify(updated));
      router.push(await resolvePostAuthPath(updated));
    } catch (err) {
      const msg = err.response?.data?.message || 'That code did not work. Please try again.';
      setError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally { setBusy(''); }
  };

  return (
    <OnboardingShell title="Verify your email" steps={STEPS}>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{notice}</div>}

      <p className="text-sm leading-relaxed text-steel dark:text-neutral-400">
        We sent a 6-digit code to <strong className="text-ink dark:text-white">{user?.email || 'your email'}</strong>. It expires in 5 minutes.
      </p>

      <div className="mt-6">
        <label htmlFor="code" className="label">One-time code</label>
        <input
          id="code"
          className="input text-center text-2xl font-bold tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <button type="button" disabled={busy === 'verify' || code.length !== 6} onClick={verify} className="btn-primary mt-6 w-full text-[15px]" aria-busy={busy === 'verify'}>
        {busy === 'verify' ? 'Verifying…' : <>Verify <span aria-hidden="true">→</span></>}
      </button>

      <p className="mt-4 text-center text-sm text-steel dark:text-neutral-400">
        Didn&rsquo;t get it?{' '}
        <button type="button" disabled={busy === 'send' || cooldown > 0} onClick={() => sendCode(false)} className="font-bold text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300">
          {cooldown > 0 ? `Resend code (${cooldown}s)` : busy === 'send' ? 'Sending…' : 'Resend code'}
        </button>
      </p>
      <p className="mt-2 text-center text-[13px] text-steel dark:text-neutral-400">Check your spam folder if it is not in your inbox.</p>
    </OnboardingShell>
  );
}
