'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';

const NAV = [
  { href: '/owner/dashboard',   icon: 'dashboard', label: 'Dashboard' },
  { href: '/owner/vehicles',    icon: 'vehicle', label: 'Vehicles' },
  { href: '/owner/drivers',     icon: 'drivers', label: 'Drivers' },
  { href: '/owner/contracts',   icon: 'contract', label: 'Contracts' },
  { href: '/owner/payments',    icon: 'payments', label: 'Payments' },
  { href: '/owner/maintenance', icon: 'maintenance', label: 'Maintenance' },
  { href: '/owner/disputes',    icon: 'disputes', label: 'Disputes' },
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

export default function OwnerContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [contracts, setContracts]   = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [selected, setSelected]     = useState(null);

  useEffect(() => {
    if (!user) return;
    contractsApi.list({ limit: 50 })
      .then((r) => setContracts(r.data?.data?.contracts || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Contracts">
      <SectionHeader title="My Contracts" description="All vehicle contracts you are party to" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="📄" title="No contracts yet" description="Contracts appear once a vehicle is assigned and an agreement is created with a driver." />
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
                  <div>
                    <p className="text-neutral-500">Total Amount</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Amount Paid</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Remaining</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS((c.totalAmount || 0) - (c.amountPaid || 0))}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Installment</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.installmentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Frequency</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{c.paymentFrequency || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Deposit</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.depositAmount)}</p>
                  </div>
                  {c.terms && (
                    <div className="col-span-2">
                      <p className="text-neutral-500">Terms summary</p>
                      <p className="text-white mt-0.5 leading-relaxed">{c.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
