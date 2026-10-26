'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';

import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OwnerDriversPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching]   = useState(true);

  useEffect(() => {
    if (!user) return;
    contractsApi.list({ limit: 50 })
      .then((r) => setContracts(r.data?.data?.contracts || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  // Build a driver list from contracts where I am the OWNER party
  const driverContracts = contracts.filter((c) => {
    const ownerParty = c.parties?.find((p) => p.role === 'OWNER');
    return ownerParty?.userId === user?.id || c.ownerId === user?.id;
  });

  return (
    <>
      <SectionHeader title="Driver Relationships" description="Drivers assigned to your vehicles via active contracts" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading drivers…</div>
      ) : driverContracts.length === 0 ? (
        <EmptyState icon="👤" title="No drivers yet" description="Drivers appear here once a contract is created and a driver is assigned to your vehicle." />
      ) : (
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-dark-border text-left">
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Driver</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Vehicle</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Contract Type</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Start Date</th>
                <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {driverContracts.map((c, i) => {
                const driverParty = c.parties?.find((p) => p.role === 'DRIVER');
                const driver = driverParty?.user || c.driver;
                return (
                  <tr key={c.id} className={`${i !== driverContracts.length - 1 ? 'border-b border-neutral-200 dark:border-dark-border' : ''}`}>
                    <td className="px-4 py-3 text-white font-medium">
                      {driver ? `${driver.firstName} ${driver.lastName}` : (c.driverName || '—')}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{c.vehicle?.registrationNumber || c.vehicleId || '—'}</td>
                    <td className="px-4 py-3 text-neutral-400">{c.type?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-4 py-3 text-neutral-400">{fmtDate(c.startDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
