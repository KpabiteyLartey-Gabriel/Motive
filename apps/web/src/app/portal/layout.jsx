'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import NotificationBell from '@/components/dashboard/NotificationBell';
import { getPortalNav } from '@/lib/portalNav';
import { useAuth } from '@/lib/useAuth';

// Persistent portal shell: mounts once; only page content swaps on navigation.
export default function PortalLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const navItems = getPortalNav(user);

  const current = navItems.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const title = pathname === '/portal/notifications' ? 'Notifications' : current?.label || 'Portal';

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={navItems} title={title} headerActions={<NotificationBell />}>
      {children}
    </DashboardShell>
  );
}
