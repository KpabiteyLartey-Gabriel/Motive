'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { ADMIN_NAV } from '@/components/dashboard/AdminHelpers';
import { useAuth } from '@/lib/useAuth';

// Persistent admin shell: this layout mounts once and stays mounted while
// navigating between admin pages, so the sidebar and header never reload —
// only the page content (children) swaps and fetches its own data.
export default function AdminLayout({ children }) {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const pathname = usePathname();

  const current = ADMIN_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const title = pathname === '/admin/dashboard' ? 'Admin - +Motive' : current?.label || 'Admin';

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title={title}>
      {children}
    </DashboardShell>
  );
}
