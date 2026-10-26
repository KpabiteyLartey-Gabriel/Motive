'use client';

import { usePathname } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { COMPANY_NAV, COMPANY_ROLES } from '@/lib/companyNav';
import { useAuth } from '@/lib/useAuth';

const TITLES = {
  '/company/dashboard': 'Company Dashboard',
  '/company/tracking': 'Tracking & Remote Control',
};

// Persistent company shell: mounts once; only page content swaps on navigation.
export default function CompanyLayout({ children }) {
  const { user, loading, logout } = useAuth({ requiredRoles: COMPANY_ROLES });
  const pathname = usePathname();

  const current = COMPANY_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={COMPANY_NAV} title={TITLES[pathname] || current?.label || 'Company'}>
      {children}
    </DashboardShell>
  );
}
