'use client';

import { useEffect, useRef, useState } from 'react';
import { usersApi, resolveVehiclePhoto } from '@/lib/api';

// Profile picture for every user, wherever their Settings live (User
// portal, Driver, Owner, company/fleet). The picture is the person's
// face across the app — chat, and the driver line on an owner's vehicle.
export default function ProfilePicture({ user, accountLabel }) {
  const [profile, setProfile] = useState(user || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const photoRef = useRef(null);

  useEffect(() => { setProfile((p) => ({ ...(p || {}), ...(user || {}) })); }, [user]);

  useEffect(() => {
    let live = true;
    usersApi.getMe()
      .then((res) => { if (live) setProfile(res.data?.data || res.data); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file for your profile picture.'); return; }
    setBusy(true); setError(''); setNotice(''); setFailed(false);
    try {
      const res = await usersApi.uploadProfilePhoto(file);
      const me = res.data?.data || res.data;
      setProfile(me);
      try {
        const stored = JSON.parse(localStorage.getItem('gh_motive_user') || '{}');
        localStorage.setItem('gh_motive_user', JSON.stringify({ ...stored, ...me }));
      } catch { /* stored user refresh is best-effort */ }
      setNotice('Profile picture updated. It now shows wherever your name appears.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not upload that picture. Please try another image.';
      setError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally { setBusy(false); }
  };

  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Your account';
  const initials = `${(profile?.firstName || '?')[0]}${(profile?.lastName || '')[0]}`.toUpperCase();
  const src = profile?.profilePhotoUrl && !failed ? resolveVehiclePhoto(profile.profilePhotoUrl) : '';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${name} profile`} onError={() => setFailed(true)} className="h-16 w-16 rounded-full border border-neutral-300 object-cover dark:border-dark-border" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 text-lg font-bold text-neutral-500 dark:bg-dark-border" aria-hidden="true">{initials}</div>
        )}
        <div>
          <p className="text-sm font-semibold text-ink dark:text-white">{name}</p>
          <p className="text-xs text-steel dark:text-neutral-400">
            {profile?.email || ''}{accountLabel ? ` · ${accountLabel}` : ''}
          </p>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={upload} aria-label="Upload a new profile picture" />
          <button
            type="button"
            disabled={busy}
            onClick={() => photoRef.current?.click()}
            className="mt-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-dark-border"
          >
            {busy ? 'Uploading…' : profile?.profilePhotoUrl ? 'Change profile picture' : 'Add profile picture'}
          </button>
        </div>
      </div>
      {notice && <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-400">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-steel dark:text-neutral-500">Use a clear picture of your face. It shows in chat and anywhere your account is named.</p>
    </div>
  );
}
