'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import NotificationBell from '@/components/dashboard/NotificationBell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { useAuth } from '@/lib/useAuth';

const TITLES = {
  '/owner/dashboard': 'Owner Dashboard',
  '/owner/messages': 'Chat',
  '/owner/payments': 'Payments',
  '/owner/contracts': 'Contracts',
  '/owner/vehicles': 'My Vehicles',
  '/owner/maintenance': 'Servicing',
  '/owner/tracking': 'Vehicle Tracking',
  '/owner/account': 'My Account',
  '/owner/settings': 'Settings',
  '/owner/notifications': 'Notifications',
};

// Persistent owner shell: mounts once; only page content swaps on navigation.
export default function OwnerLayout({ children }) {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const pathname = usePathname();

  const current = OWNER_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={OWNER_NAV} title={TITLES[pathname] || current?.label || 'Owner'} headerActions={<NotificationBell href="/owner/notifications" />}>
      {children}
    </DashboardShell>
  );
}
