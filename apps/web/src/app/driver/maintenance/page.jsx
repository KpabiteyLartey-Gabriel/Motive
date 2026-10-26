'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { maintenanceApi } from '@/lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DriverMaintenancePage() {
  const { user } = useAuth({ requiredRoles: ['DRIVER'] });
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    maintenanceApi.list({ limit: 50 })
      .then((r) => setRequests(r.data?.data?.requests || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  return (
    <>
      <SectionHeader title="Maintenance" description="Service and repair requests for the vehicle you drive" />
      {fetching ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState icon="maintenance" title="No maintenance requests" description="Maintenance requests for your vehicle will appear here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-card border border-line bg-white p-4 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink dark:text-white">{(r.type || 'Maintenance').replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 text-xs text-steel dark:text-neutral-500">
                    {r.vehicle?.registrationNumber ? `${r.vehicle.registrationNumber} · ` : ''}{fmtDate(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.description && <p className="mt-2 text-sm leading-relaxed text-steel dark:text-neutral-400">{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
