'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';

const NAV = [
  { href: '/company/dashboard',    icon: 'dashboard', label: 'Dashboard' },
  { href: '/company/vehicles',     icon: 'vehicle', label: 'Fleet' },
  { href: '/company/drivers',      icon: 'drivers', label: 'Drivers' },
  { href: '/company/contracts',    icon: 'contract', label: 'Contracts' },
  { href: '/company/payments',     icon: 'payments', label: 'Payments' },
  { href: '/company/maintenance',  icon: 'maintenance', label: 'Maintenance' },
  { href: '/company/tracking',     icon: 'tracking', label: 'Tracking' },
  { href: '/company/reports',      icon: 'reports', label: 'Reports' },
  { href: '/company/team',         icon: 'users', label: 'Team' },
  { href: '/company/disputes',     icon: 'disputes', label: 'Disputes' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CompanyDriversPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['COMPANY_ADMIN', 'COMPANY_MEMBER', 'FLEET_MANAGER'] });
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching]   = useState(true);

  useEffect(() => {
    if (!user) return;
    contractsApi.list({ limit: 100 })
      .then((r) => setContracts(r.data?.data?.contracts || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  const driverContracts = contracts.filter((c) => c.parties?.some((p) => p.role === 'DRIVER') || c.driverId);

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Drivers">
      <SectionHeader title="Driver Roster" description="Drivers assigned under your company's vehicle contracts" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading drivers…</div>
      ) : driverContracts.length === 0 ? (
        <EmptyState icon="👤" title="No drivers" description="Drivers will appear here once contracts are created and drivers are assigned to company vehicles." />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border text-left">
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Driver</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Vehicle</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Contract Type</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Start Date</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {driverContracts.map((c, i) => {
                const driverParty = c.parties?.find((p) => p.role === 'DRIVER');
                const driver = driverParty?.user || c.driver;
                return (
                  <tr key={c.id} className={i !== driverContracts.length - 1 ? 'border-b border-neutral-200 dark:border-dark-border' : ''}>
                    <td className="px-4 py-3 text-white font-medium">
                      {driver ? `${driver.firstName} ${driver.lastName}` : (c.driverName || '—')}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{c.vehicle?.registrationNumber || c.vehicleId || '—'}</td>
                    <td className="px-4 py-3 text-neutral-400">{c.type?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-4 py-3 text-neutral-400">{fmtDate(c.startDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
