'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';
import { FLEET_NAV, FLEET_ROLES } from '@/lib/fleetNav';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FleetContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: FLEET_ROLES });
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    contractsApi.list({ limit: 100 })
      .then((r) => setContracts(r.data?.data?.contracts || r.data?.data || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={FLEET_NAV} title="Contracts">
      <SectionHeader title="Contracts" description="Work & Pay, Rental and Driving On contracts involving your fleet" />
      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="📄" title="No contracts" description="Contracts created for your fleet vehicles will appear here." />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div key={c.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{c.title || c.contractNumber}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{c.contractNumber} · {c.type?.replace(/_/g, ' ')} · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {selected?.id === c.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-neutral-500">Vehicle</p><p className="text-neutral-900 dark:text-white mt-0.5">{c.vehicle?.registrationNumber || c.vehicleId || '—'}</p></div>
                  <div><p className="text-neutral-500">Parties</p><p className="text-neutral-900 dark:text-white mt-0.5">{(c.parties || []).map((p) => p.role).join(', ') || '—'}</p></div>
                  <div className="col-span-2"><p className="text-neutral-500">Description</p><p className="text-neutral-900 dark:text-white mt-0.5">{c.description || '—'}</p></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
