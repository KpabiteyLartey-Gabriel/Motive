'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';

import { SectionHeader, StatusBadge } from '@/components/dashboard/DashboardUI';
import { usersApi, ownersApi, resolveVehiclePhoto } from '@/lib/api';
import { formatGhanaCardInput } from '@/lib/ghanaCard';

function syncStoredUser(updated) {
  try {
    const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
    localStorage.setItem('gh_motive_user', JSON.stringify({ ...stored, ...updated }));
  } catch {}
}

function VerifyRow({ label, value, verifiedAt, onSend, onConfirm, busy }) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const verified = !!verifiedAt;
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-neutral-200 dark:border-dark-border last:border-0">
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
        <p className="text-xs text-neutral-500">{value || 'Not provided'}</p>
      </div>
      {verified ? (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/30">
          Verified {new Date(verifiedAt).toLocaleDateString('en-GB')}
        </span>
      ) : sent ? (
        <span className="flex items-center gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="input w-32 text-center tracking-widest" />
          <button disabled={busy || code.length !== 6} onClick={async () => { if (await onConfirm(code)) setSent(false); }} className="text-xs font-medium px-3 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">Confirm</button>
          <button disabled={busy} onClick={async () => { await onSend(); }} className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:opacity-40">Resend</button>
        </span>
      ) : (
        <button disabled={busy || !value} onClick={async () => { if (await onSend()) setSent(true); }} className="text-xs font-medium px-3 py-2 rounded-lg border border-neutral-300 dark:border-dark-border disabled:opacity-40">
          Send verification code
        </button>
      )}
    </div>
  );
}

export default function OwnerSettingsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [profile, setProfile] = useState(null);
  const [owner, setOwner] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', otherNames: '', phone: '', gender: '', dateOfBirth: '' });
  const [ownerForm, setOwnerForm] = useState({ ghanaCardNumber: '', address: '', city: '', region: '', momoNumber: '', momoProvider: '', bankName: '', bankAccountNumber: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const photoRef = useRef(null);

  const load = () => {
    if (!user) return;
    usersApi.getMe().then((r) => {
      const me = r.data?.data || r.data;
      setProfile(me);
      setForm({
        firstName: me.firstName || '', lastName: me.lastName || '', otherNames: me.otherNames || '',
        phone: me.phone || '', gender: me.gender || '', dateOfBirth: me.dateOfBirth ? String(me.dateOfBirth).slice(0, 10) : '',
      });
    }).catch(() => {});
    ownersApi.getMyProfile().then((r) => {
      const o = r.data?.data || r.data;
      setOwner(o);
      setOwnerForm({
        ghanaCardNumber: o.ghanaCardNumber || '', address: o.address || '', city: o.city || '', region: o.region || '',
        momoNumber: o.momoNumber || '', momoProvider: o.momoProvider || '', bankName: o.bankName || '', bankAccountNumber: o.bankAccountNumber || '',
      });
    }).catch(() => {});
  };

  useEffect(load, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (err, fallback) => setError(Array.isArray(err.response?.data?.message) ? err.response.data.message.join(', ') : err.response?.data?.message || fallback);
  const note = (text) => { setMsg(text); setError(''); };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setMsg('');
    try {
      const payload = { ...form, gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined };
      const res = await usersApi.updateMe(payload);
      const me = res.data?.data || res.data;
      setProfile(me); syncStoredUser(me);
      note('Profile updated.');
    } catch (err) { fail(err, 'Could not update profile.'); }
    finally { setBusy(false); }
  };

  const saveOwner = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await ownersApi.updateProfile(ownerForm);
      setOwner(res.data?.data || res.data);
      note('Owner details saved. Identity verification is reviewed by the +Motive team.');
    } catch (err) { fail(err, 'Could not save owner details.'); }
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
      note('Profile picture updated.');
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
      note('Password changed. Other sessions have been signed out.');
    } catch (err) { fail(err, 'Could not change password.'); }
    finally { setBusy(false); }
  };

  const sendCode = (kind) => async () => {
    setBusy(true); setError(''); setMsg('');
    try {
      const res = kind === 'email' ? await usersApi.sendEmailCode() : await usersApi.sendPhoneCode();
      note(res.data?.data?.message || 'Verification code sent.');
      return true;
    } catch (err) { fail(err, 'Could not send verification code.'); return false; }
    finally { setBusy(false); }
  };

  const confirmCode = (kind) => async (code) => {
    setBusy(true); setError(''); setMsg('');
    try {
      const res = kind === 'email' ? await usersApi.confirmEmailCode(code) : await usersApi.confirmPhoneCode(code);
      note(res.data?.data?.message || 'Verified.');
      load();
      return true;
    } catch (err) { fail(err, 'That code did not work.'); return false; }
    finally { setBusy(false); }
  };

  const deactivate = async () => {
    if (!window.confirm('Deactivate your account? You will be signed out and will not be able to sign in until an admin reactivates you.')) return;
    setBusy(true); setError('');
    try { await usersApi.deactivateMe(); logout(); }
    catch (err) { fail(err, 'Could not deactivate account.'); setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <>
      <SectionHeader title="Settings" description="Your account configuration, verifications and security" />
      {msg && <div className="bg-green-500/10 border border-green-500/30 text-green-600 text-sm px-4 py-3 rounded-lg mb-4">{msg}</div>}
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      {/* Profile */}
      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-5">
        <div className="flex items-center gap-4 mb-5">
          {profile?.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveVehiclePhoto(profile.profilePhotoUrl)} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-neutral-300 dark:border-dark-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-dark-border flex items-center justify-center text-lg font-bold text-neutral-500">{(profile?.firstName || 'O')[0]}{(profile?.lastName || '')[0]}</div>
          )}
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{profile?.firstName} {profile?.lastName}</p>
            <p className="text-xs text-neutral-500">{profile?.email || ''} · Vehicle Owner</p>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
            <button disabled={busy} onClick={() => photoRef.current?.click()} className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-dark-border disabled:opacity-40">Change profile picture</button>
          </div>
        </div>
        <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-3">
          <input required className="input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input required className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input className="input" placeholder="Other names (optional)" value={form.otherNames} onChange={(e) => setForm({ ...form, otherNames: e.target.value })} />
          <input className="input" placeholder="Phone (+233...)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Gender (optional)</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} aria-label="Date of birth" />
          <div><button disabled={busy} className="text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </div>

      {/* Verifications */}
      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-5">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">Verifications</p>
        <p className="text-xs text-neutral-500 mt-1 mb-2">Verified contact details keep your account secure and your payment notifications reliable.</p>
        <VerifyRow label="Email address" value={profile?.email} verifiedAt={profile?.emailVerifiedAt} busy={busy} onSend={sendCode('email')} onConfirm={confirmCode('email')} />
        <VerifyRow label="Phone number" value={profile?.phone} verifiedAt={profile?.phoneVerifiedAt} busy={busy} onSend={sendCode('phone')} onConfirm={confirmCode('phone')} />
        <div className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">Identity (Ghana Card)</p>
            <p className="text-xs text-neutral-500">{owner?.ghanaCardNumber ? `Card on file: ${owner.ghanaCardNumber}` : 'Add your Ghana Card number under Owner details below'}</p>
          </div>
          {owner ? <StatusBadge status={owner.status} /> : <span className="text-xs text-neutral-400">—</span>}
        </div>
        <p className="text-xs text-neutral-500">Identity status is reviewed by the +Motive team{owner?.verifiedAt ? ` · Verified on ${new Date(owner.verifiedAt).toLocaleDateString('en-GB')}` : ''}. It cannot be changed from here.</p>
      </div>

      {/* Owner + payout details */}
      <form onSubmit={saveOwner} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-5">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Owner &amp; payout details</p>
        <p className="text-xs text-neutral-500 mb-4">Your MoMo number is where contract payments are settled. Keep it correct.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Ghana Card (GHA-123456789-0)" maxLength={15} value={ownerForm.ghanaCardNumber} onChange={(e) => setOwnerForm({ ...ownerForm, ghanaCardNumber: formatGhanaCardInput(e.target.value) })} />
          <input className="input" placeholder="MoMo number (+233...)" value={ownerForm.momoNumber} onChange={(e) => setOwnerForm({ ...ownerForm, momoNumber: e.target.value })} />
          <input className="input" placeholder="MoMo provider (MTN, Telecel, AirtelTigo)" value={ownerForm.momoProvider} onChange={(e) => setOwnerForm({ ...ownerForm, momoProvider: e.target.value })} />
          <input className="input" placeholder="Residential address" value={ownerForm.address} onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })} />
          <input className="input" placeholder="City" value={ownerForm.city} onChange={(e) => setOwnerForm({ ...ownerForm, city: e.target.value })} />
          <input className="input" placeholder="Region" value={ownerForm.region} onChange={(e) => setOwnerForm({ ...ownerForm, region: e.target.value })} />
          <input className="input" placeholder="Bank name (optional)" value={ownerForm.bankName} onChange={(e) => setOwnerForm({ ...ownerForm, bankName: e.target.value })} />
          <input className="input" placeholder="Bank account number (optional)" value={ownerForm.bankAccountNumber} onChange={(e) => setOwnerForm({ ...ownerForm, bankAccountNumber: e.target.value })} />
        </div>
        <button disabled={busy} className="mt-3 text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Saving…' : 'Save owner details'}</button>
      </form>

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
          <div><p className="text-neutral-500">Role</p><p className="text-neutral-900 dark:text-white mt-0.5">Vehicle Owner</p></div>
          <div><p className="text-neutral-500">Member since</p><p className="text-neutral-900 dark:text-white mt-0.5">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB') : '—'}</p></div>
          <div><p className="text-neutral-500">Last sign-in</p><p className="text-neutral-900 dark:text-white mt-0.5">{profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('en-GB') : '—'}</p></div>
        </div>
        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-dark-border">
          <p className="text-xs text-neutral-500 mb-2">Deactivating signs you out everywhere. An admin can reactivate your account.</p>
          <button disabled={busy} onClick={deactivate} className="text-xs font-medium px-4 py-2 rounded-lg border border-red-300 text-red-600 disabled:opacity-40">Deactivate my account</button>
        </div>
      </div>
    </>
  );
}
