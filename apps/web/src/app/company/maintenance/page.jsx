'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { maintenanceApi } from '@/lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const URGENCY_COLORS = { LOW: 'text-neutral-400', MEDIUM: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400' };

export default function CompanyMaintenancePage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['COMPANY_ADMIN', 'COMPANY_MEMBER', 'FLEET_MANAGER'] });
  const [requests, setRequests]   = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [selected, setSelected]   = useState(null);
  const [approving, setApproving] = useState(null);

  useEffect(() => {
    if (!user) return;
    maintenanceApi.list({ limit: 100 })
      .then((r) => setRequests(r.data?.data?.requests || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const approve = async (id) => {
    setApproving(id);
    try {
      await maintenanceApi.update(id, { status: 'APPROVED' });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'APPROVED' } : r));
    } catch {}
    setApproving(null);
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <>
      <SectionHeader title="Maintenance Requests" description="Service and repair requests for your fleet" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading maintenance requests…</div>
      ) : requests.length === 0 ? (
        <EmptyState icon="🔧" title="No maintenance requests" description="Maintenance requests from drivers for your fleet will appear here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer hover:border-neutral-600 transition-colors"
              onClick={() => setSelected(selected?.id === r.id ? null : r)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{r.type?.replace(/_/g, ' ') || 'Maintenance'}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Vehicle: {r.vehicle?.registrationNumber || r.vehicleId || '—'} &middot; {fmtDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${URGENCY_COLORS[r.urgency] || 'text-neutral-400'}`}>{r.urgency}</span>
                  <StatusBadge status={r.status} />
                </div>
              </div>

              {selected?.id === r.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border space-y-3">
                  <p className="text-xs text-neutral-400 leading-relaxed">{r.description || '—'}</p>
                  {r.status === 'REQUESTED' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); approve(r.id); }}
                      disabled={approving === r.id}
                      className="btn-graphite text-xs disabled:opacity-60"
                    >
                      {approving === r.id ? 'Approving…' : 'Approve Request'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
