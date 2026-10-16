'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, complianceApi } from '@/lib/api';
import VehiclePhotos from '@/components/vehicles/VehiclePhotos';

const NAV = OWNER_NAV;

const STATUS_COLORS = {
  AVAILABLE: 'text-green-400',
  ASSIGNED: 'text-blue-400',
  MAINTENANCE: 'text-yellow-400',
  INACTIVE: 'text-neutral-500',
};

export default function OwnerVehiclesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [vehicles, setVehicles]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    if (!user) return;
    vehiclesApi.list({ limit: 50 })
      .then((r) => setVehicles(r.data?.data?.vehicles || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="My Vehicles">
      <SectionHeader title="Registered Vehicles" description="Vehicles registered under your account" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading vehicles…</div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon="🚗" title="No vehicles yet" description="You haven't registered any vehicles. Contact the administrator to register your first vehicle." />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer hover:border-neutral-600 transition-colors"
              onClick={() => setSelected(selected?.id === v.id ? null : v)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{v.registrationNumber}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{v.make} {v.model} {v.year && `· ${v.year}`}</p>
                </div>
                <span className={`text-xs font-medium ${STATUS_COLORS[v.status] || 'text-neutral-500'}`}>{v.status}</span>
              </div>

              {selected?.id === v.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
                  <VehiclePhotos vehicle={v} editable onPhotosChange={(upd) => { setVehicles((prev) => prev.map((x) => (x.id === upd.id ? { ...x, ...upd } : x))); setSelected((s) => (s?.id === upd.id ? { ...s, ...upd } : s)); }} />
                  <div>
                    <p className="text-neutral-500">VIN / Chassis</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.vin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Type</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.type || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Colour</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.color || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Verified</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.verified ? 'Yes' : 'Pending'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-neutral-500">Description</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{v.description || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
