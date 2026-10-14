'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatCard, SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import Link from 'next/link';
import { contractsApi, paymentsApi, vehiclesApi } from '@/lib/api';

const NAV = [
  { href: '/driver/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/driver/vehicle',   icon: 'vehicle', label: 'My Vehicle' },
  { href: '/driver/contracts', icon: 'contract', label: 'Contracts' },
  { href: '/driver/payments',  icon: 'payments', label: 'Payments' },
  { href: '/driver/earnings',  icon: 'earnings', label: 'Earnings' },
  { href: '/driver/documents', icon: 'documents', label: 'Documents' },
  { href: '/driver/disputes',  icon: 'disputes', label: 'Disputes' },
];

function fmtGHS(amount) {
  if (!amount && amount !== 0) return 'â€”';
  return `GHS ${Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DriverDashboardPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['DRIVER'] });

  const [contracts, setContracts] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [vehicle,   setVehicle]   = useState(null);
  const [fetching,  setFetching]  = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    Promise.allSettled([
      contractsApi.list({ limit: 50 }),
      paymentsApi.list({ limit: 50 }),
      vehiclesApi.list({ limit: 1 }),
    ]).then(([cRes, pRes, vRes]) => {
      if (cRes.status === 'fulfilled') setContracts(cRes.value.data?.data?.contracts || []);
      if (pRes.status === 'fulfilled') setPayments(pRes.value.data?.data?.payments || []);
      if (vRes.status === 'fulfilled') setVehicle(vRes.value.data?.data?.vehicles?.[0] || null);
    }).finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const activeContract = contracts.find((c) => c.status === 'ACTIVE') || null;
  const successfulPayments = payments.filter((p) => p.status === 'SUCCESSFUL');
  const totalPaid = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingPayments = payments.filter((p) => ['PENDING', 'PROCESSING'].includes(p.status));
  const balanceDue = activeContract?.outstandingBalance || activeContract?.remainingBalance || 0;
  const recentPayments = payments.slice(0, 5);

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Driver Dashboard">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>
          Welcome back, {user?.firstName}
        </h2>
        <p className="text-sm text-steel dark:text-neutral-500">
          Here&apos;s an overview of your vehicle operations and payment status.
        </p>
      </div>

      {/* Account status */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-xs text-neutral-500">Account status:</span>
        <StatusBadge status={user?.status} />
        {fetching && <span className="text-xs text-neutral-600">Refreshingâ€¦</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Contracts"  value={activeContract ? 1 : 0}       sub={activeContract ? activeContract.type?.replace(/_/g, ' ') : 'No contracts'} />
        <StatCard label="Total Paid"        value={fmtGHS(totalPaid)}             sub="All time" accent />
        <StatCard label="Balance Due"       value={fmtGHS(balanceDue)}            sub="Remaining" />
        <StatCard label="Payments Made"     value={successfulPayments.length}     sub="Successful" />
      </div>

      {/* Assigned vehicle */}
      <SectionHeader title="My Vehicle" description="Vehicle currently assigned to you" />
      {!vehicle ? (
        <EmptyState icon="ðŸš—" title="No vehicle assigned" description="An owner or company will assign you a vehicle once a contract is created." action={null} />
      ) : (
        <Link href="/driver/vehicle" className="block bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card shadow-card dark:shadow-none p-5 hover:border-neutral-600 transition-colors mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-ink dark:text-white">{vehicle.make} {vehicle.model} <span className="text-neutral-500 font-normal text-sm">({vehicle.year})</span></p>
              <p className="text-xs text-neutral-500 mt-1">{vehicle.registrationNumber || vehicle.licensePlate || 'No plate'} &middot; {vehicle.color || ''}</p>
            </div>
            <StatusBadge status={vehicle.status} />
          </div>
        </Link>
      )}

      {/* Active contract */}
      <SectionHeader title="Active Contract" description="Your current vehicle arrangement" />
      {!activeContract ? (
        <EmptyState icon="ðŸ“„" title="No active contract" description="You don't have an active contract yet. An owner or company will invite you once a vehicle is assigned." action={null} />
      ) : (
        <Link href="/driver/contracts" className="block bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card shadow-card dark:shadow-none p-5 hover:border-neutral-600 transition-colors mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-white">{activeContract.type?.replace(/_/g, ' ')}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Started {fmtDate(activeContract.startDate)}</p>
              {activeContract.nextPaymentDue && (
                <p className="text-xs text-neutral-400 mt-1">Next payment: <span className="text-ink dark:text-white">{fmtDate(activeContract.nextPaymentDue)}</span></p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 mb-1">Balance remaining</p>
              <p className="money text-base font-bold text-ink dark:text-white">{fmtGHS(balanceDue)}</p>
            </div>
          </div>
          {pendingPayments.length > 0 && (
            <div className="mt-3 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-xs text-warning">{pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''} pending processing</p>
            </div>
          )}
        </Link>
      )}

      {/* Recent payments */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Recent Payments" description="Your latest payment transactions" />
          <Link href="/driver/payments" className="text-xs text-neutral-500 hover:text-brand-700 dark:hover:text-brand-300 transition-colors font-semibold">View all â†’</Link>
        </div>
        {recentPayments.length === 0 ? (
          <EmptyState icon="ðŸ’³" title="No payments yet" description="Your payment history will appear here once you have an active contract." action={null} />
        ) : (
          <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card shadow-card dark:shadow-none overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors">
                    <td className="money px-4 py-3 text-sm text-ink dark:text-white font-semibold">{fmtGHS(p.amount)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500 font-mono hidden sm:table-cell">{p.reference || p.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-neutral-500 hidden md:table-cell">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profile completion */}
      {user?.status !== 'VERIFIED' && (
        <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card shadow-card dark:shadow-none p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center flex-shrink-0">
            <span className="text-warning text-sm">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white mb-1">Complete your driver profile</p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Add your licence number, Ghana Card number and emergency contact to get verified and matched with vehicles.
            </p>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

