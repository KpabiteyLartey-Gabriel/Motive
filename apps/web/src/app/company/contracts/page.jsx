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
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', RENTAL: 'Rental', DRIVING_ON: 'Driving On' };

export default function CompanyContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['COMPANY_ADMIN', 'COMPANY_MEMBER', 'FLEET_MANAGER'] });
  const [contracts, setContracts]   = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [selected, setSelected]     = useState(null);

  useEffect(() => {
    if (!user) return;
    contractsApi.list({ limit: 100 })
      .then((r) => setContracts(r.data?.data?.contracts || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Contracts">
      <SectionHeader title="Company Contracts" description="All contracts involving your company's vehicles and drivers" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="📄" title="No contracts" description="Contracts will appear here once vehicle and driver relationships are established." />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer hover:border-neutral-600 transition-colors"
              onClick={() => setSelected(selected?.id === c.id ? null : c)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{TYPE_LABEL[c.type] || c.type}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {c.vehicle?.registrationNumber || c.vehicleId || '—'} &middot; {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              {selected?.id === c.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-neutral-500">Total Amount</p><p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.totalAmount)}</p></div>
                  <div><p className="text-neutral-500">Amount Paid</p><p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.amountPaid)}</p></div>
                  <div><p className="text-neutral-500">Remaining</p><p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS((c.totalAmount || 0) - (c.amountPaid || 0))}</p></div>
                  <div><p className="text-neutral-500">Installment</p><p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.installmentAmount)}</p></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
