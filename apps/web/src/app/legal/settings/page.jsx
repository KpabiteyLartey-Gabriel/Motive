'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, StatusBadge } from '@/components/dashboard/DashboardUI';
import { usersApi, companiesApi, resolveVehiclePhoto } from '@/lib/api';
import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

function syncStoredUser(updated) {
  try {
    const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
    localStorage.setItem('gh_motive_user', JSON.stringify({ ...stored, ...updated }));
  } catch {}
}

export default function LegalSettingsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', otherNames: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const photoRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    usersApi.getMe().then((r) => {
      const me = r.data?.data || r.data;
      setProfile(me);
      setForm({ firstName: me.firstName || '', lastName: me.lastName || '', otherNames: me.otherNames || '', phone: me.phone || '' });
    }).catch(() => {});
    companiesApi.mine().then((r) => setCompany((r.data?.data || [])[0] || null)).catch(() => {});
  }, [user]);

  const fail = (err, fallback) => setError(Array.isArray(err.response?.data?.message) ? err.response.data.message.join(', ') : err.response?.data?.message || fallback);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await usersApi.updateMe(form);
      const me = res.data?.data || res.data;
      setProfile(me); syncStoredUser(me);
      setMsg('Profile updated.');
    } catch (err) { fail(err, 'Could not update profile.'); }
    finally { setBusy(false); }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await usersApi.uploadProfilePhoto(file);
      const me = res.data?.data || res.data;
      setProfile(me); syncStoredUser(me);
      setMsg('Profile picture updated.');
    } catch (err) { fail(err, 'Could not upload picture.'); }
    finally { setBusy(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) { setError('New passwords do not match.'); return; }
    setBusy(true); setError(''); setMsg('');
    try {
      await usersApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg('Password changed. Other sessions have been signed out.');
    } catch (err) { fail(err, 'Could not change password.'); }
    finally { setBusy(false); }
  };

  const deactivate = async () => {
    if (!window.confirm('Deactivate your account? You will be signed out and will not be able to sign in until a company or platform admin reactivates you.')) return;
    setBusy(true); setError('');
    try { await usersApi.deactivateMe(); logout(); }
    catch (err) { fail(err, 'Could not deactivate account.'); setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={LEGAL_NAV} title="Settings">
      <SectionHeader title="Settings" description="Your profile, security and account status" />
      {msg && <div className="bg-green-500/10 border border-green-500/30 text-green-600 text-sm px-4 py-3 rounded-lg mb-4">{msg}</div>}
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      {/* Profile picture + profile */}
      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-5">
        <div className="flex items-center gap-4 mb-5">
          {profile?.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveVehiclePhoto(profile.profilePhotoUrl)} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-neutral-300 dark:border-dark-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-dark-border flex items-center justify-center text-lg font-bold text-neutral-500">{(profile?.firstName || 'L')[0]}{(profile?.lastName || 'P')[0]}</div>
          )}
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{profile?.firstName} {profile?.lastName}</p>
            <p className="text-xs text-neutral-500">{profile?.email || ''}</p>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
            <button disabled={busy} onClick={() => photoRef.current?.click()} className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-dark-border disabled:opacity-40">Change profile picture</button>
          </div>
        </div>
        <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-3">
          <input required className="input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input required className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input className="input" placeholder="Other names (optional)" value={form.otherNames} onChange={(e) => setForm({ ...form, otherNames: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div><button disabled={busy} className="text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </div>

      {/* Password */}
      <form onSubmit={changePw} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-5">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Change password</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input required type="password" className="input" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <input required type="password" minLength={8} className="input" placeholder="New password (min 8)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          <input required type="password" className="input" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </div>
        <button disabled={busy} className="mt-3 text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Changing…' : 'Change password'}</button>
      </form>

      {/* Account status */}
      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Account status</p>
        <div className="grid grid-cols-2 gap-3 text-xs max-w-lg">
          <div><p className="text-neutral-500">Account status</p><div className="mt-1">{profile ? <StatusBadge status={profile.status} /> : '—'}</div></div>
          <div><p className="text-neutral-500">Role</p><p className="text-neutral-900 dark:text-white mt-0.5">Legal Professional</p></div>
          <div><p className="text-neutral-500">Company</p><p className="text-neutral-900 dark:text-white mt-0.5">{company?.name || '—'}</p></div>
          <div><p className="text-neutral-500">Membership</p><p className="text-neutral-900 dark:text-white mt-0.5">{company ? `${company.myRole?.replace(/_/g, ' ')} · Active` : '—'}</p></div>
          <div><p className="text-neutral-500">Member since</p><p className="text-neutral-900 dark:text-white mt-0.5">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB') : '—'}</p></div>
          <div><p className="text-neutral-500">Last sign-in</p><p className="text-neutral-900 dark:text-white mt-0.5">{profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('en-GB') : '—'}</p></div>
        </div>
        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-dark-border">
          <p className="text-xs text-neutral-500 mb-2">Deactivating signs you out everywhere. A company admin or platform admin can reactivate your account.</p>
          <button disabled={busy} onClick={deactivate} className="text-xs font-medium px-4 py-2 rounded-lg border border-red-300 text-red-600 disabled:opacity-40">Deactivate my account</button>
        </div>
      </div>
    </DashboardShell>
  );
}
