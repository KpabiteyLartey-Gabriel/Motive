'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { resolvePostAuthPath, storeAuth } from '@/lib/onboarding';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Continue with Google using Google Identity Services. The web client id
// must be the same one the backend checks as GOOGLE_CLIENT_ID.
export default function GoogleButton({ label = 'Continue with Google' }) {
  const router = useRouter();
  const hostRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCredential = useCallback(async (response) => {
    if (!response?.credential) return;
    setBusy(true);
    setError('');
    try {
      const res = await authApi.google(response.credential);
      const data = res.data?.data || res.data;
      storeAuth(data);
      router.push(await resolvePostAuthPath(data.user));
    } catch (err) {
      const message = err.response?.data?.message || 'Google sign-in failed. Please try again or use your email and password.';
      setError(Array.isArray(message) ? message.join(' ') : message);
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    if (!CLIENT_ID || !hostRef.current) return undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !hostRef.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      hostRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(hostRef.current, {
        theme: 'outline', size: 'large', type: 'standard', shape: 'rectangular', text: 'continue_with', width: 352,
      });
    };

    if (window.google?.accounts?.id) { render(); return () => { cancelled = true; }; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [handleCredential]);

  if (!CLIENT_ID) {
    return (
      <div>
        <button type="button" disabled className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-steel opacity-60 dark:border-dark-border dark:bg-dark-card dark:text-neutral-400" title="Google sign-in is not configured yet">
          <GoogleMark /> {label} — not configured yet
        </button>
        <p className="field-hint">Not configured yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={hostRef} className={busy ? 'pointer-events-none opacity-60' : ''} aria-busy={busy} />
      {busy && <p className="field-hint">Signing you in with Google…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.58v2.97h3.88c2.27-2.09 3.57-5.17 3.57-8.74z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-2.97c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.96H1.28v3.07A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31V6.62H1.28a12 12 0 0 0 0 10.76l4.01-3.07z" />
      <path fill="#EA4335" d="M12 4.73c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 11.99 11.99 0 0 0 1.28 6.62l4.01 3.07C6.23 6.84 8.88 4.73 12 4.73z" />
    </svg>
  );
}
