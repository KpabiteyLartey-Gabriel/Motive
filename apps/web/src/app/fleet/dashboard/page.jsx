'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { StatCard, SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, maintenanceApi, contractsApi, trackingApi, companiesApi } from '@/lib/api';
import { FLEET_ROLES } from '@/lib/fleetNav';

export default function FleetDashboardPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: FLEET_ROLES });
  const [company, setCompany] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      companiesApi.mine().catch(() => null),
      vehiclesApi.list({ limit: 100 }).catch(() => null),
      maintenanceApi.list({ limit: 100 }).catch(() => null),
      contractsApi.list({ limit: 100 }).catch(() => null),
      trackingApi.listAlerts({ limit: 100 }).catch(() => null),
    ]).then(([co, v, m, c, a]) => {
      setCompany((co?.data?.data || [])[0] || null);
      setVehicles(v?.data?.data?.vehicles || []);
      setMaintenance(m?.data?.data?.requests || []);
      setContracts(c?.data?.data?.contracts || c?.data?.data || []);
      setAlerts(a?.data?.data?.alerts || []);
    }).finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  const openMaintenance = maintenance.filter((r) => ['REQUESTED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_FOR_PARTS'].includes(r.status)).length;
  const unreadAlerts = alerts.filter((a) => !a.isRead).length;

  return (
    <>
      <SectionHeader title={`Welcome, ${user?.firstName || 'Fleet Manager'}`} description={company ? `Fleet Manager · ${company.name}` : 'Fleet Manager'} />
      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading fleet overview…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Fleet vehicles" value={vehicles.length} />
            <StatCard label="Open maintenance" value={openMaintenance} />
            <StatCard label="Contracts" value={Array.isArray(contracts) ? contracts.length : 0} />
            <StatCard label="Unread alerts" value={unreadAlerts} />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { href: '/fleet/vehicles', title: 'Fleet Vehicles', text: 'Vehicle details, photos, insurance, roadworthiness and registration documents.' },
              { href: '/fleet/tracking', title: 'Tracking & Remote Control', text: 'Live location, speed alerts, tracker devices, engine off/on commands.' },
              { href: '/fleet/maintenance', title: 'Maintenance', text: 'Raise and track service, repair and inspection requests.' },
              { href: '/fleet/contracts', title: 'Contracts', text: 'Work & Pay, Rental and Driving On contracts for your fleet.' },
              { href: '/fleet/settings', title: 'Settings', text: 'Profile, profile picture, password and account status.' },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 hover:border-neutral-500 transition-colors">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">{c.title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{c.text}</p>
              </Link>
            ))}
          </div>

          {vehicles.length === 0 && (
            <div className="mt-6"><EmptyState icon="🚗" title="No fleet vehicles yet" description="Vehicles your company manages will appear here once a company admin assigns them." /></div>
          )}
        </>
      )}
    </>
  );
}
