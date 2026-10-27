'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, StatusBadge } from '@/components/dashboard/DashboardUI';

import { usersApi } from '@/lib/api';
import ProfilePicture from '@/components/settings/ProfilePicture';

export default function PortalSettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' });
  }, [user]);

  const fail = (err, fallback) => {
    const msg = err.response?.data?.message || fallback;
    setError(Array.isArray(msg) ? msg.join(' ') : msg);
  };

  const saveProfile = async () => {
    setBusy('profile'); setError(''); setMessage('');
    try {
      const res = await usersApi.updateMe({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() || undefined });
      const updated = res.data?.data || res.data;
      const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
      localStorage.setItem('gh_motive_user', JSON.stringify({ ...stored, ...updated }));
      setMessage('Profile saved.');
    } catch (err) { fail(err, 'Could not save your profile.'); } finally { setBusy(''); }
  };

  const savePassword = async () => {
    if (passwords.newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (passwords.newPassword !== passwords.confirmPassword) { setError('New passwords do not match.'); return; }
    setBusy('password'); setError(''); setMessage('');
    try {
      await usersApi.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password updated. Other sessions have been signed out.');
    } catch (err) { fail(err, 'Could not update your password.'); } finally { setBusy(''); }
  };

  return (
    <>
      <SectionHeader title="Settings" description="Your profile and security." />
      {message && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{message}</div>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
          <h3 className="text-base font-semibold text-ink dark:text-white">Profile</h3>
          <div className="mt-4"><ProfilePicture user={user} accountLabel="User" /></div>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="firstName" className="label">First name</label><input id="firstName" className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><label htmlFor="lastName" className="label">Last name</label><input id="lastName" className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div><label htmlFor="email" className="label">Email</label><input id="email" className="input" value={user?.email || ''} disabled /></div>
            <div><label htmlFor="phone" className="label">Phone number</label><input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+233 20 123 4567" /></div>
            <div className="flex items-center justify-between text-sm"><span className="text-steel dark:text-neutral-400">Email verified</span><StatusBadge status={user?.emailVerifiedAt ? 'VERIFIED' : 'PENDING'} /></div>
            <div className="flex items-center justify-between text-sm"><span className="text-steel dark:text-neutral-400">Account type</span><span className="font-semibold text-ink dark:text-white">User</span></div>
            <button type="button" disabled={busy === 'profile'} onClick={saveProfile} className="btn-primary w-full" aria-busy={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
          </div>
        </section>

        <section className="rounded-card border border-line bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
          <h3 className="text-base font-semibold text-ink dark:text-white">Password</h3>
          <div className="mt-4 space-y-4">
            <div><label htmlFor="currentPassword" className="label">Current password</label><input id="currentPassword" type="password" className="input" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></div>
            <div><label htmlFor="newPassword" className="label">New password</label><input id="newPassword" type="password" className="input" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></div>
            <div><label htmlFor="confirmPassword" className="label">Confirm new password</label><input id="confirmPassword" type="password" className="input" autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></div>
            <button type="button" disabled={busy === 'password'} onClick={savePassword} className="btn-primary w-full" aria-busy={busy === 'password'}>{busy === 'password' ? 'Updating…' : 'Update password'}</button>
          </div>
        </section>
      </div>
    </>
  );
}
