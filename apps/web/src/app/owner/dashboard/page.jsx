'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';

import { StatCard, SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import Link from 'next/link';
import { vehiclesApi, contractsApi, paymentsApi } from '@/lib/api';

function fmtGHS(amount) {
  if (!amount && amount !== 0) return 'â€”';
  return `GHS ${Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OwnerDashboardPage() {
  const { user } = useAuth({ requiredRoles: ['OWNER'] });

  const [vehicles,  setVehicles]  = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [fetching,  setFetching]  = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    Promise.allSettled([
      vehiclesApi.list({ limit: 50 }),
      contractsApi.list({ limit: 100 }),
      paymentsApi.list({ limit: 50 }),
    ]).then(([vRes, cRes, pRes]) => {
      if (vRes.status === 'fulfilled') setVehicles(vRes.value.data?.data?.vehicles || []);
      if (cRes.status === 'fulfilled') setContracts(cRes.value.data?.data?.contracts || []);
      if (pRes.status === 'fulfilled') setPayments(pRes.value.data?.data?.payments || []);
    }).finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthPayments = payments.filter((p) => p.status === 'SUCCESSFUL' && new Date(p.createdAt) >= monthStart);
  // Payment amounts arrive as strings (Prisma Decimal) — convert before adding or they concatenate.
  const collectedMonth = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const overdueContracts = contracts.filter((c) => c.status === 'ACTIVE' && c.nextPaymentDue && new Date(c.nextPaymentDue) < now);
  const recentPayments = payments.slice(0, 5);

  return (
    <>
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>
          Welcome back, {user?.firstName}
        </h2>
        <p className="text-sm text-steel dark:text-neutral-500">
          Manage your vehicles, contracts and payment collections from here.
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
        <StatCard label="Total Vehicles"     value={vehicles.length}              sub="Registered" />
        <StatCard label="Active Contracts"   value={activeContracts.length}       sub="Running" />
        <StatCard label="Collected (Month)"  value={fmtGHS(collectedMonth)}       sub="This month" accent />
        <StatCard label="Overdue"            value={overdueContracts.length}      sub="Contracts past due" />
      </div>

      {/* Vehicles */}
      <SectionHeader title="Your Vehicles" description="Vehicles registered under your account" />
      {vehicles.length === 0 ? (
        <EmptyState
          icon="ðŸš—"
          title="No vehicles yet"
          description="Register your first vehicle to create contracts and assign drivers."
          action={
            <Link href="/owner/vehicles" className="btn-graphite text-sm">
              Register Vehicle
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {vehicles.slice(0, 6).map((v) => (
            <Link key={v.id} href="/owner/vehicles" className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card p-4 hover:border-neutral-600 transition-colors">
              <p className="text-sm font-semibold text-ink dark:text-white">{v.make} {v.model} <span className="text-neutral-500 font-normal">({v.year})</span></p>
              <p className="text-xs text-neutral-500 mt-0.5">{v.registrationNumber || v.licensePlate || 'No plate'}</p>
              <div className="mt-2"><StatusBadge status={v.status} /></div>
            </Link>
          ))}
        </div>
      )}

      {/* Active contracts */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Active Contracts" description="Ongoing driver arrangements" />
          <Link href="/owner/contracts" className="text-xs text-neutral-500 hover:text-white transition-colors">View all â†’</Link>
        </div>
        {activeContracts.length === 0 ? (
          <EmptyState icon="ðŸ“„" title="No active contracts" description="Once you assign a driver to a vehicle, your contracts will appear here." action={null} />
        ) : (
          <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Next Due</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                {activeContracts.slice(0, 5).map((c) => (
                  <tr key={c.id} className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors">
                    <td className="px-4 py-3 text-xs text-white">{c.driver ? `${c.driver.user?.firstName} ${c.driver.user?.lastName}` : 'â€”'}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400 hidden sm:table-cell">{c.type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-neutral-500 hidden md:table-cell">{fmtDate(c.nextPaymentDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent payments */}
      {recentPayments.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Recent Payments" description="Latest collections" />
            <Link href="/owner/payments" className="text-xs text-neutral-500 hover:text-white transition-colors">View all â†’</Link>
          </div>
          <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors">
                    <td className="px-4 py-3 text-xs text-white font-medium">{fmtGHS(p.amount)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400 hidden sm:table-cell">{p.payer ? `${p.payer.firstName} ${p.payer.lastName}` : 'â€”'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-neutral-500 hidden md:table-cell">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile completion notice â€” only show if not verified */}
      {user?.status !== 'VERIFIED' && (
        <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center flex-shrink-0">
            <span className="text-warning text-sm">!</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-1">Complete your owner profile</p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Add your Ghana Card number and MoMo details so drivers can make payments to you and the platform can verify your ownership.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

