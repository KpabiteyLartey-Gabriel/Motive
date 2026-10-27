'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import NotificationBell from '@/components/dashboard/NotificationBell';
import { DRIVER_NAV, DRIVER_ROLES } from '@/lib/driverNav';
import { useAuth } from '@/lib/useAuth';

const TITLES = {
  '/driver/dashboard': 'Driver Dashboard',
  '/driver/explore': 'Explore vehicles',
  '/driver/vehicle': 'My Vehicle',
  '/driver/contracts': 'Contracts',
  '/driver/messages': 'Chat',
  '/driver/payments': 'Payments',
  '/driver/maintenance': 'Servicing',
  '/driver/account': 'My Account',
  '/driver/settings': 'Settings',
  '/driver/notifications': 'Notifications',
};

// Persistent driver shell: mounts once; only page content swaps on navigation.
export default function DriverLayout({ children }) {
  const { user, loading, logout } = useAuth({ requiredRoles: DRIVER_ROLES });
  const pathname = usePathname();

  const current = DRIVER_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={DRIVER_NAV} title={TITLES[pathname] || current?.label || 'Driver'} headerActions={<NotificationBell href="/driver/notifications" />}>
      {children}
    </DashboardShell>
  );
}
