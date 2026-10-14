'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { ADMIN_NAV, AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const MAINTENANCE_STATUSES = ['REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'];

function MaintenanceDrawer({ request, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Maintenance Request</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Header */}
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-2">{request.id}</p>
            <StatusBadge status={request.status} />
          </div>

          {/* Details */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Vehicle',    value: request.vehicle ? `${request.vehicle.make} ${request.vehicle.model} (${request.vehicle.registrationNumber || request.vehicle.licensePlate || ''})` : '—' },
              { label: 'Requested By', value: request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : '—' },
              { label: 'Type',       value: request.type?.replace(/_/g, ' ') || '—' },
              { label: 'Priority',   value: request.priority || '—' },
              { label: 'Est. Cost',  value: request.estimatedCost != null ? `GHS ${Number(request.estimatedCost).toLocaleString()}` : '—' },
              { label: 'Actual Cost',value: request.actualCost != null ? `GHS ${Number(request.actualCost).toLocaleString()}` : '—' },
              { label: 'Scheduled',  value: request.scheduledDate ? fmt(request.scheduledDate) : '—' },
              { label: 'Completed',  value: request.completedAt ? fmt(request.completedAt) : '—' },
              { label: 'Created',    value: fmt(request.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          {request.description && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Description</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{request.description}</p>
            </div>
          )}

          {/* Resolution notes */}
          {request.resolutionNotes && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Resolution Notes</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{request.resolutionNotes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminMaintenancePage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [requests, setRequests]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listMaintenance({ page, limit: 20, status: statusFilter || undefined })
      .then((res) => {
        setRequests(res.data.data.requests);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const COLS = [
    {
      key: 'vehicle', label: 'Vehicle',
      render: (r) => (
        <span className="text-graphite dark:text-paper font-medium text-xs">
          {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : '—'}
          {r.vehicle?.licensePlate && (
            <span className="ml-1 text-neutral-500 font-mono">({r.vehicle.licensePlate})</span>
          )}
        </span>
      ),
    },
    {
      key: 'requestedBy', label: 'Requested By', hidden: 'hidden sm:table-cell',
      render: (r) => (
        <span className="text-neutral-400 text-xs">
          {r.requestedBy ? `${r.requestedBy.firstName} ${r.requestedBy.lastName}` : '—'}
        </span>
      ),
    },
    {
      key: 'type', label: 'Type', hidden: 'hidden md:table-cell',
      render: (r) => <span className="text-neutral-400 text-xs">{r.type?.replace(/_/g, ' ') || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'estimatedCost', label: 'Est. Cost', hidden: 'hidden md:table-cell',
      render: (r) => (
        <span className="text-neutral-400 text-xs">
          {r.estimatedCost != null ? `GHS ${Number(r.estimatedCost).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt', label: 'Date', hidden: 'hidden lg:table-cell',
      render: (r) => <span className="text-neutral-500 text-xs">{fmt(r.createdAt)}</span>,
    },
  ];

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Maintenance">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Maintenance</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} maintenance request${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select
          className="input w-52"
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {MAINTENANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={requests} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <MaintenanceDrawer
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </DashboardShell>
  );
}
