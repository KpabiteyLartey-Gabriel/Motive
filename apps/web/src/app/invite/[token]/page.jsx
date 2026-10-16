'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { invitesApi, authApi } from '@/lib/api';

const ROLE_LABEL = {
  COMPANY_ADMIN: 'Company Admin',
  FLEET_MANAGER: 'Fleet Manager',
  COMPANY_MEMBER: 'Company Member',
  LEGAL_PROFESSIONAL: 'Lawyer / Legal',
};

const ROLE_REDIRECTS = {
  DRIVER: '/driver/dashboard', OWNER: '/owner/dashboard',
  COMPANY_ADMIN: '/company/dashboard', COMPANY_MEMBER: '/company/dashboard',
  FLEET_MANAGER: '/fleet/dashboard', SERVICE_PROVIDER: '/service/dashboard',
  LEGAL_PROFESSIONAL: '/legal/dashboard', ADMIN: '/admin/dashboard', SUPER_ADMIN: '/admin/dashboard',
};

export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invitesApi.resolve(token)
      .then((r) => {
        const inv = r.data?.data || r.data;
        setInvite(inv);
        setForm((f) => ({ ...f, email: inv.email || '', phone: inv.phone || '' }));
      })
      .catch((err) => setLoadError(err.response?.data?.message || 'This invitation link is not valid.'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const res = await invitesApi.accept(token, {
        firstName: form.firstName, lastName: form.lastName, password: form.password,
        email: invite.email ? undefined : form.email || undefined,
        phone: invite.phone ? undefined : form.phone || undefined,
      });
      const accepted = res.data?.data || res.data;
      // Sign in with the password just created and land on the role portal.
      const identifier = accepted.user.email || accepted.user.phone;
      const login = await authApi.login({ identifier, password: form.password });
      const { accessToken, refreshToken, user } = login.data.data;
      localStorage.setItem('gh_motive_access_token', accessToken);
      localStorage.setItem('gh_motive_refresh_token', refreshToken);
      localStorage.setItem('gh_motive_user', JSON.stringify(user));
      router.push(ROLE_REDIRECTS[user.primaryRole] || '/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not set up your account.');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-chalk dark:bg-dark-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-2xl p-6">
        <p className="text-xs font-semibold tracking-wide text-neutral-500 mb-1">+MOTIVE INVITATION</p>
        {loadError ? (
          <>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Invitation not available</h1>
            <p className="text-sm text-neutral-500 mb-4">{loadError}</p>
            <Link href="/login" className="text-sm underline">Go to sign in</Link>
          </>
        ) : !invite ? (
          <p className="text-sm text-neutral-500">Loading invitation…</p>
        ) : (
          <>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">Join {invite.company?.name}</h1>
            <p className="text-sm text-neutral-500 mt-1 mb-5">
              You have been invited to join <strong>{invite.company?.name}</strong> as a{' '}
              <strong>{ROLE_LABEL[invite.role] || invite.role}</strong>
              {invite.title ? ` (${invite.title})` : ''}. Set up your account below — it will be tied to this
              company with that role, and you will sign in with it from now on.
            </p>
            {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input required className="input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <input required className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              {invite.email ? (
                <input className="input" value={form.email} disabled />
              ) : (
                <input className="input" type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              )}
              {invite.phone ? (
                <input className="input" value={form.phone} disabled />
              ) : (
                <input className="input" placeholder="Phone (optional, e.g. +233…)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              )}
              <input required type="password" minLength={8} className="input" placeholder="Create a password (min 8 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input required type="password" className="input" placeholder="Confirm password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
              <button disabled={busy} className="btn-primary w-full text-[15px] disabled:opacity-50">
                {busy ? 'Setting up…' : `Set up my account & join ${invite.company?.name}`}
              </button>
            </form>
            <p className="text-xs text-neutral-400 mt-4">
              Already have an account? <Link href="/login" className="underline">Sign in</Link> and ask your company admin to add your existing account instead. This link expires {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString('en-GB') : 'in 7 days'}.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
