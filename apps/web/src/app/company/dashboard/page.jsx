'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatCard, SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import Link from 'next/link';
import { vehiclesApi, driversApi, contractsApi, paymentsApi, maintenanceApi } from '@/lib/api';

const NAV = [
  { href: '/company/dashboard',   icon: 'dashboard', label: 'Dashboard' },
  { href: '/company/vehicles',    icon: 'vehicle', label: 'Fleet' },
  { href: '/company/drivers',     icon: 'drivers', label: 'Drivers' },
  { href: '/company/contracts',   icon: 'contract', label: 'Contracts' },
  { href: '/company/payments',    icon: 'payments', label: 'Payments' },
  { href: '/company/maintenance', icon: 'maintenance', label: 'Maintenance' },
  { href: '/company/tracking',    icon: 'tracking', label: 'Tracking' },
  { href: '/company/reports',     icon: 'reports', label: 'Reports' },
  { href: '/company/team',        icon: 'users', label: 'Team' },
  { href: '/company/disputes',    icon: 'disputes', label: 'Disputes' },
];

function fmtGHS(amount) {
  if (!amount && amount !== 0) return 'â€”';
  return `GHS ${Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CompanyDashboardPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['COMPANY_ADMIN', 'COMPANY_MEMBER', 'FLEET_MANAGER'] });

  const [vehicles,     setVehicles]     = useState([]);
  const [drivers,      setDrivers]      = useState([]);
  const [contracts,    setContracts]    = useState([]);
  const [payments,     setPayments]     = useState([]);
  const [maintenance,  setMaintenance]  = useState([]);
  const [fetching,     setFetching]     = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    Promise.allSettled([
      vehiclesApi.list({ limit: 100 }),
      driversApi.list({ limit: 100 }),
      contractsApi.list({ limit: 100 }),
      paymentsApi.list({ limit: 50 }),
      maintenanceApi.list({ limit: 20 }),
    ]).then(([vRes, dRes, cRes, pRes, mRes]) => {
      if (vRes.status === 'fulfilled') setVehicles(vRes.value.data?.data?.vehicles || []);
      if (dRes.status === 'fulfilled') setDrivers(dRes.value.data?.data?.drivers || []);
      if (cRes.status === 'fulfilled') setContracts(cRes.value.data?.data?.contracts || []);
      if (pRes.status === 'fulfilled') setPayments(pRes.value.data?.data?.payments || []);
      if (mRes.status === 'fulfilled') setMaintenance(mRes.value.data?.data?.requests || []);
    }).finally(() => setFetching(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const activeVehicles  = vehicles.filter((v) => v.status === 'ACTIVE');
  const activeDrivers   = drivers.filter((d) => d.status === 'ACTIVE');
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = payments
    .filter((p) => p.status === 'SUCCESSFUL' && new Date(p.createdAt) >= monthStart)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const openMaintenance = maintenance.filter((m) => ['REQUESTED', 'APPROVED', 'IN_PROGRESS', 'SCHEDULED'].includes(m.status));
  const recentPayments  = payments.slice(0, 5);

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Company Dashboard">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>
          Welcome back, {user?.firstName}
        </h2>
        <p className="text-sm text-steel dark:text-neutral-500">
          Manage your fleet, drivers, contracts and financials from here.
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
        <StatCard label="Fleet Size"        value={vehicles.length}        sub={`${activeVehicles.length} active`} />
        <StatCard label="Active Drivers"    value={activeDrivers.length}   sub="Assigned" />
        <StatCard label="Active Contracts"  value={activeContracts.length} sub="Running" />
        <StatCard label="Revenue (Month)"   value={fmtGHS(monthRevenue)}   sub="This month" accent />
      </div>

      {/* Open maintenance alert */}
      {openMaintenance.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <span className="text-warning text-sm font-semibold">{openMaintenance.length} open</span>
          <span className="text-warning/70 text-xs">maintenance request{openMaintenance.length !== 1 ? 's' : ''} awaiting action</span>
          <Link href="/company/maintenance" className="ml-auto text-xs text-warning underline hover:text-yellow-300">View â†’</Link>
        </div>
      )}

      {/* Fleet overview */}
      <SectionHeader title="Fleet Overview" description="All vehicles under your company" />
      {vehicles.length === 0 ? (
        <EmptyState
          icon="ðŸš—"
          title="No fleet vehicles yet"
          description="Register your first vehicle or import existing ones to start managing your fleet."
          action={
            <Link href="/company/vehicles" className="btn-graphite text-sm">
              Add Vehicle
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {vehicles.slice(0, 6).map((v) => (
            <Link key={v.id} href="/company/vehicles" className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card p-4 hover:border-neutral-600 transition-colors">
              <p className="text-sm font-semibold text-ink dark:text-white">{v.make} {v.model} <span className="text-neutral-500 font-normal">({v.year})</span></p>
              <p className="text-xs text-neutral-500 mt-0.5">{v.registrationNumber || v.licensePlate || 'No plate'}</p>
              <div className="mt-2"><StatusBadge status={v.status} /></div>
            </Link>
          ))}
          {vehicles.length > 6 && (
            <Link href="/company/vehicles" className="bg-white dark:bg-dark-card border border-line dark:border-dark-border border-dashed rounded-card p-4 flex items-center justify-center text-xs text-neutral-500 hover:text-white hover:border-neutral-600 transition-colors">
              +{vehicles.length - 6} more vehicles â†’
            </Link>
          )}
        </div>
      )}

      {/* Driver roster */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Driver Roster" description="Drivers currently assigned to your fleet" />
          <Link href="/company/drivers" className="text-xs text-neutral-500 hover:text-white transition-colors">View all â†’</Link>
        </div>
        {drivers.length === 0 ? (
          <EmptyState icon="ðŸ‘¤" title="No drivers yet" description="Assign drivers to vehicles to build your roster." action={null} />
        ) : (
          <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden md:table-cell">Joined</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                {drivers.slice(0, 5).map((d) => (
                  <tr key={d.id} className="hover:bg-chalk dark:hover:bg-dark-elevated transition-colors">
                    <td className="px-4 py-3 text-xs text-white">{d.user ? `${d.user.firstName} ${d.user.lastName}` : 'â€”'}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400 hidden sm:table-cell">{d.user?.phone || 'â€”'}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-neutral-500 hidden md:table-cell">{fmtDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent revenue */}
      {recentPayments.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Recent Revenue" description="Latest payment transactions" />
            <Link href="/company/payments" className="text-xs text-neutral-500 hover:text-white transition-colors">View all â†’</Link>
          </div>
          <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200 dark:border-dark-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 hidden sm:table-cell">Driver</th>
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

      {/* Setup notice */}
      {user?.status !== 'VERIFIED' && (
        <div className="bg-white dark:bg-dark-card border border-line dark:border-dark-border rounded-card p-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center flex-shrink-0">
            <span className="text-warning text-sm">!</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-1">Complete your company profile</p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Add your company registration number, TIN, MoMo details and bank account so the platform can verify your company.
            </p>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

