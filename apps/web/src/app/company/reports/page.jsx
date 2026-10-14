'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, contractsApi, paymentsApi, maintenanceApi, incidentsApi } from '@/lib/api';

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

function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CompanyReportsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['COMPANY_ADMIN', 'COMPANY_MEMBER', 'FLEET_MANAGER'] });
  const [stats, setStats]     = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      vehiclesApi.list({ limit: 1 }).catch(() => null),
      contractsApi.list({ limit: 1 }).catch(() => null),
      paymentsApi.list({ limit: 500 }).catch(() => null),
      maintenanceApi.list({ limit: 500 }).catch(() => null),
      incidentsApi.list({ limit: 500 }).catch(() => null),
    ]).then(([vRes, cRes, pRes, mRes, iRes]) => {
      const payments    = pRes?.data?.data?.payments || [];
      const maintenance = mRes?.data?.data?.requests || [];
      const incidents   = iRes?.data?.data?.incidents || [];
      const totalRevenue = payments.filter((p) => p.status === 'SUCCESSFUL').reduce((s, p) => s + Number(p.amount || 0), 0);
      const pendingRevenue = payments.filter((p) => ['PENDING', 'INITIATED'].includes(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0);

      setStats({
        vehicles:    vRes?.data?.data?.total  || 0,
        contracts:   cRes?.data?.data?.total  || 0,
        totalRevenue,
        pendingRevenue,
        openMaintenance: maintenance.filter((r) => ['REQUESTED', 'APPROVED', 'IN_PROGRESS'].includes(r.status)).length,
        openIncidents:   incidents.filter((r) => ['REPORTED', 'UNDER_REVIEW'].includes(r.status)).length,
        paymentCount:    payments.length,
        successPayments: payments.filter((p) => p.status === 'SUCCESSFUL').length,
      });
    }).finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Reports">
      <SectionHeader title="Fleet Reports" description="Summary of your company's operational metrics" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Generating report…</div>
      ) : !stats ? (
        <EmptyState icon="📊" title="No data" description="Reports will populate once your fleet is operational." />
      ) : (
        <>
          {/* Revenue */}
          <h3 className="text-xs font-semibold text-fog uppercase tracking-widest mb-3">Financial</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Total Revenue Collected</p>
              <p className="text-lg font-bold text-green-400">{fmtGHS(stats.totalRevenue)}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Pending Revenue</p>
              <p className="text-lg font-bold text-yellow-400">{fmtGHS(stats.pendingRevenue)}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Payment Success Rate</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-white">
                {stats.paymentCount > 0 ? `${Math.round((stats.successPayments / stats.paymentCount) * 100)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Operations */}
          <h3 className="text-xs font-semibold text-fog uppercase tracking-widest mb-3">Operations</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Fleet Vehicles</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats.vehicles}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Active Contracts</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats.contracts}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Open Maintenance</p>
              <p className={`text-xl font-bold ${stats.openMaintenance > 0 ? 'text-yellow-400' : 'text-white'}`}>{stats.openMaintenance}</p>
            </div>
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Open Incidents</p>
              <p className={`text-xl font-bold ${stats.openIncidents > 0 ? 'text-red-400' : 'text-white'}`}>{stats.openIncidents}</p>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5">
            <p className="text-xs text-neutral-500 mb-2">Note</p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Detailed analytics, vehicle utilization charts, and driver performance reports are available in the admin panel or via the reporting API. This summary reflects data accessible to your role.
            </p>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
