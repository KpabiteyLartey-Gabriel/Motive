'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { useAuth } from '@/lib/useAuth';

const TITLES = {
  '/owner/dashboard': 'Owner Dashboard',
  '/owner/vehicles': 'My Vehicles',
  '/owner/drivers': 'My Drivers',
  '/owner/tracking': 'Vehicle Tracking',
  '/owner/messages': 'Chat',
  '/owner/contracts': 'Contract',
  '/owner/account': 'My Account',
  '/owner/notifications': 'Notification',
};

// Persistent owner shell: mounts once; only page content swaps on navigation.
export default function OwnerLayout({ children }) {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const pathname = usePathname();

  const current = OWNER_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={OWNER_NAV} title={TITLES[pathname] || current?.label || 'Owner'}>
      {children}
    </DashboardShell>
  );
}
