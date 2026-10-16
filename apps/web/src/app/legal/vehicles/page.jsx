'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, contractsApi } from '@/lib/api';
import VehiclePhotos from '@/components/vehicles/VehiclePhotos';
import VehicleDocuments from '@/components/vehicles/VehicleDocuments';
import { LEGAL_NAV, LEGAL_ROLES } from '@/lib/legalNav';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VehicleContracts({ vehicleId }) {
  const [contracts, setContracts] = useState(null);
  useEffect(() => {
    contractsApi.list({ limit: 50, vehicleId })
      .then((r) => setContracts(r.data?.data?.contracts || []))
      .catch(() => setContracts([]));
  }, [vehicleId]);
  if (contracts === null) return <p className="text-neutral-400">Loading contracts…</p>;
  if (!contracts.length) return <p className="text-neutral-400">No contracts for this vehicle.</p>;
  return (
    <div className="space-y-1">
      {contracts.map((c) => (
        <div key={c.id} className="flex flex-wrap justify-between gap-2">
          <span className="text-neutral-800 dark:text-neutral-200">{c.contractNumber} · {c.type?.replace(/_/g, ' ')}</span>
          <span className="flex items-center gap-2"><span className="text-neutral-500">{fmt(c.startDate)} – {fmt(c.endDate)}</span><StatusBadge status={c.status} /></span>
        </div>
      ))}
    </div>
  );
}

export default function LegalVehiclesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: LEGAL_ROLES });
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    vehiclesApi.list({ limit: 100 })
      .then((r) => setVehicles(r.data?.data?.vehicles || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const filtered = search.trim()
    ? vehicles.filter((v) => `${v.registrationNumber} ${v.make} ${v.model}`.toLowerCase().includes(search.toLowerCase()))
    : vehicles;

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={LEGAL_NAV} title="Vehicles">
      <SectionHeader title="Vehicles" description="Every vehicle, with its contracts and the paperwork it needs" />
      <input className="input max-w-xs mb-5" placeholder="Search registration, make, model…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading vehicles…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🚗" title="No vehicles" description="Registered vehicles will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <div key={v.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 cursor-pointer" onClick={() => setSelected(selected?.id === v.id ? null : v)}>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{v.registrationNumber}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{v.make} {v.model} {v.year ? `· ${v.year}` : ''} · Owner: {v.owner?.user ? `${v.owner.user.firstName} ${v.owner.user.lastName}` : '—'}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
              {selected?.id === v.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
                  <VehiclePhotos vehicle={v} />
                  <div className="col-span-2">
                    <p className="text-neutral-500 mb-2">Contracts for this vehicle</p>
                    <VehicleContracts vehicleId={v.id} />
                  </div>
                  <VehicleDocuments vehicle={v} canManage />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
