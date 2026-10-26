'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export function useAuth({ requiredRoles } = {}) {
  const router = useRouter();
  const [user, setUser]       = useState(null);
  // Start as null (unknown) so we can distinguish "not yet checked" from
  // "checked and loading data". We only show the auth-loading skeleton when
  // null; once we have a user (or redirect) we set it to false.
  const [loading, setLoading] = useState(true);

  const rolesKey = requiredRoles ? requiredRoles.slice().sort().join(',') : '';

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });

  useEffect(() => {
    const token  = localStorage.getItem('gh_motive_access_token');
    const stored = localStorage.getItem('gh_motive_user');

    if (!token || !stored) {
      routerRef.current.replace('/login');
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      if (rolesKey) {
        const allowed = rolesKey.split(',');
        // A user can hold several accounts at once (Driver + Owner +
        // Service Provider + company roles), so any held role qualifies,
        // not just the primary one.
        const held = new Set([parsed.primaryRole]);
        const roleList = Array.isArray(parsed.roles) ? parsed.roles : [];
        for (const r of roleList) {
          if (typeof r === 'string') held.add(r);
          else if (r?.role?.name) held.add(r.role.name);
          else if (r?.name) held.add(r.name);
        }
        if (!allowed.some((role) => held.has(role))) {
          routerRef.current.replace('/login');
          return;
        }
      }

      setUser(parsed);
      setLoading(false);

      // The stored user is a login-time snapshot: refresh it so changes
      // made elsewhere (admin verification, profile updates, suspension)
      // show up without forcing a re-login.
      authApi.me()
        .then(async (res) => {
          const fresh = res.data?.data;
          if (!fresh?.id) return;
          const merged = { ...parsed, ...fresh };
          localStorage.setItem('gh_motive_user', JSON.stringify(merged));
          setUser(merged);

          // Accounts with an unverified email finish email verification
          // first; account-type setup happens later.
          if (merged.email && !merged.emailVerifiedAt && !window.location.pathname.startsWith('/verify-email')) {
            routerRef.current.replace('/verify-email');
          }
        })
        .catch(() => {});
    } catch {
      routerRef.current.replace('/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey]);

  const logout = () => {
    localStorage.removeItem('gh_motive_access_token');
    localStorage.removeItem('gh_motive_refresh_token');
    localStorage.removeItem('gh_motive_user');
    router.push('/login');
  };

  return { user, loading, logout };
}
