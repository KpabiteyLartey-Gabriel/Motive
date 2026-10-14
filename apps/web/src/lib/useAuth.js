'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
        if (!allowed.includes(parsed.primaryRole)) {
          routerRef.current.replace('/login');
          return;
        }
      }

      setUser(parsed);
      setLoading(false);
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
