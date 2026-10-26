'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { FLEET_NAV, FLEET_ROLES } from '@/lib/fleetNav';
import { useAuth } from '@/lib/useAuth';

const TITLES = {
  '/fleet/dashboard': 'Fleet Manager',
  '/fleet/tracking': 'Tracking & Remote Control',
};

// Persistent fleet shell: mounts once; only page content swaps on navigation.
export default function FleetLayout({ children }) {
  const { user, loading, logout } = useAuth({ requiredRoles: FLEET_ROLES });
  const pathname = usePathname();

  const current = FLEET_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={FLEET_NAV} title={TITLES[pathname] || current?.label || 'Fleet'}>
      {children}
    </DashboardShell>
  );
}
