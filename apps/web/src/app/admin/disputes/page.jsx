'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const DISPUTE_STATUSES = ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'MEDIATION', 'DECISION_PENDING', 'RESOLVED', 'REJECTED', 'ESCALATED', 'CLOSED', 'APPEALED'];
const DISPUTE_TYPES    = ['PAYMENT_DISPUTE', 'CONTRACT_DISPUTE', 'VEHICLE_DAMAGE', 'VEHICLE_CONDITION', 'MAINTENANCE', 'REVENUE_DISAGREEMENT', 'VEHICLE_RETURN', 'OWNERSHIP_TRANSFER', 'OTHER'];

function DisputeDrawer({ dispute, onClose }) {
  const messages = dispute.messages || [];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Dispute Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Header */}
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-2">{dispute.id}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={dispute.status} />
              <span className="text-xs text-neutral-400">{dispute.type?.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Initiator',   value: dispute.initiator ? `${dispute.initiator.firstName} ${dispute.initiator.lastName}` : '—' },
              { label: 'Respondent',  value: dispute.respondent ? `${dispute.respondent.firstName} ${dispute.respondent.lastName}` : '—' },
              { label: 'Contract',    value: dispute.contractId || '—' },
              { label: 'Vehicle',     value: dispute.vehicle ? `${dispute.vehicle.make} ${dispute.vehicle.model} (${dispute.vehicle.registrationNumber || dispute.vehicle.licensePlate || ''})` : '—' },
              { label: 'Priority',    value: dispute.priority || '—' },
              { label: 'Assigned To', value: dispute.assignedTo ? `${dispute.assignedTo.firstName} ${dispute.assignedTo.lastName}` : 'Unassigned' },
              { label: 'Opened',      value: fmt(dispute.createdAt) },
              { label: 'Resolved',    value: dispute.resolvedAt ? fmt(dispute.resolvedAt) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          {dispute.description && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Description</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{dispute.description}</p>
            </div>
          )}

          {/* Resolution */}
          {dispute.resolution && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Resolution</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{dispute.resolution}</p>
            </div>
          )}

          {/* Message count */}
          {messages.length > 0 && (
            <div className="bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-lg px-4 py-3">
              <p className="text-xs text-neutral-400">
                <span className="text-neutral-900 dark:text-graphite dark:text-paper font-medium">{messages.length}</span> message{messages.length !== 1 ? 's' : ''} in timeline
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminDisputesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [disputes, setDisputes]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [statusFilter, setStatus]   = useState('');
  const [typeFilter, setType]       = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listDisputes({ page, limit: 20, status: statusFilter || undefined, type: typeFilter || undefined })
      .then((res) => {
        setDisputes(res.data.data.disputes);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const COLS = [
    {
      key: 'type', label: 'Type',
      render: (d) => <span className="text-neutral-300 text-xs">{d.type?.replace(/_/g, ' ') || '—'}</span>,
    },
    {
      key: 'initiator', label: 'Initiator', hidden: 'hidden sm:table-cell',
      render: (d) => (
        <span className="text-white text-xs">
          {d.initiator ? `${d.initiator.firstName} ${d.initiator.lastName}` : '—'}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'priority', label: 'Priority', hidden: 'hidden md:table-cell',
      render: (d) => <span className="text-neutral-400 text-xs">{d.priority || '—'}</span>,
    },
    {
      key: 'assignedTo', label: 'Assigned', hidden: 'hidden lg:table-cell',
      render: (d) => (
        <span className="text-neutral-400 text-xs">
          {d.assignedTo ? `${d.assignedTo.firstName} ${d.assignedTo.lastName}` : 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'createdAt', label: 'Opened', hidden: 'hidden lg:table-cell',
      render: (d) => <span className="text-neutral-500 text-xs">{fmt(d.createdAt)}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Disputes</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} dispute case${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
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
          {DISPUTE_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="input w-52"
          value={typeFilter}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          {DISPUTE_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={disputes} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <DisputeDrawer
          dispute={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
