'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const CONTRACT_STATUSES = ['DRAFT', 'PENDING_ACCEPTANCE', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'COMPLETED', 'CANCELLED'];
const CONTRACT_TYPES    = ['WORK_AND_PAY', 'RENTAL', 'DRIVING_ON'];

function ContractDrawer({ contract, onClose }) {
  const parties = contract.parties || [];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Contract Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Header */}
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-1">{contract.id}</p>
            <div className="flex items-center gap-3 mb-1">
              <StatusBadge status={contract.status} />
              <span className="text-xs text-neutral-400">{contract.type?.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Vehicle',      value: contract.vehicle ? `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.registrationNumber})` : '—' },
              { label: 'Start Date',   value: fmt(contract.startDate) },
              { label: 'End Date',     value: contract.endDate ? fmt(contract.endDate) : 'Open-ended' },
              { label: 'Total Amount', value: contract.totalAmount != null ? `GHS ${Number(contract.totalAmount).toLocaleString()}` : '—' },
              { label: 'Installment',  value: contract.installmentAmount != null ? `GHS ${Number(contract.installmentAmount).toLocaleString()}` : '—' },
              { label: 'Balance Paid', value: contract.paidAmount != null ? `GHS ${Number(contract.paidAmount).toLocaleString()}` : '—' },
              { label: 'Created',      value: fmt(contract.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Parties */}
          {parties.length > 0 && (
            <div>
              <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Parties</p>
              <div className="space-y-2">
                {parties.map((p) => (
                  <div key={p.id} className="bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-900 dark:text-graphite dark:text-paper font-medium">
                        {p.user?.firstName} {p.user?.lastName}
                      </p>
                      <p className="text-xs text-neutral-500">{p.user?.email || p.user?.phone || '—'}</p>
                    </div>
                    <span className="text-xs text-neutral-400">{p.role?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [contracts, setContracts]   = useState([]);
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
      .listContracts({ page, limit: 20, status: statusFilter || undefined, type: typeFilter || undefined })
      .then((res) => {
        setContracts(res.data.data.contracts);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const COLS = [
    {
      key: 'vehicle', label: 'Vehicle',
      render: (c) => (
          <span className="text-graphite dark:text-paper font-medium text-xs">
            {c.vehicle ? `${c.vehicle.make} ${c.vehicle.model}` : '—'}
            {c.vehicle?.registrationNumber && <span className="ml-1 text-neutral-500 font-mono">({c.vehicle.registrationNumber})</span>}
          </span>
        ),
    },
    {
      key: 'type', label: 'Type',
      render: (c) => <span className="text-neutral-400 text-xs">{c.type?.replace(/_/g, ' ') || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'totalAmount', label: 'Amount', hidden: 'hidden md:table-cell',
      render: (c) => (
        <span className="text-neutral-400 text-xs">
          {c.totalAmount != null ? `GHS ${Number(c.totalAmount).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'startDate', label: 'Start', hidden: 'hidden lg:table-cell',
      render: (c) => <span className="text-neutral-500 text-xs">{fmt(c.startDate)}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Contracts</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} contract${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
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
          {CONTRACT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="input w-52"
          value={typeFilter}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          {CONTRACT_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={contracts} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <ContractDrawer
          contract={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
