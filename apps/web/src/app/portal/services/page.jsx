'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { maintenanceApi } from '@/lib/api';
import RenewalsPanel from '@/components/servicing/RenewalsPanel';
import ServicesCatalog from '@/components/servicing/ServicesCatalog';

function fmtDate(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Services tab: the user's service & maintenance requests, mirroring the
// Maintenance tabs in the Driver and Owner portals.
export default function PortalServicesPage() {
  const { user } = useAuth();
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
      <SectionHeader title="Services" description="Service and repair requests linked to you" />
        <RenewalsPanel />
        <ServicesCatalog />
      {fetching ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState icon="services" title="No service requests" description="Service and maintenance requests for vehicles you are linked to will appear here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-card border border-line bg-white p-4 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink dark:text-white">{(r.type || 'Maintenance').replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 text-xs text-steel dark:text-neutral-500">
                    {r.vehicle?.registrationNumber ? `${r.vehicle.registrationNumber} Â· ` : ''}{fmtDate(r.createdAt)}
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
