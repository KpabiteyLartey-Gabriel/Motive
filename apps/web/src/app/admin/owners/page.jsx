'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const OWNER_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];

function OwnerDrawer({ owner, onClose, onStatusChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleStatus = async (status) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.updateOwnerStatus(owner.id, status);
      onStatusChange({ ...owner, ...res.data.data });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Owner Details</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Identity */}
          <div>
            <div className="w-12 h-12 rounded-xl bg-chalk dark:bg-dark-elevated border border-neutral-200 dark:border-dark-border flex items-center justify-center mb-4">
              <span className="text-graphite dark:text-paper font-bold text-lg">
                {owner.user?.firstName?.[0]}{owner.user?.lastName?.[0]}
              </span>
            </div>
            <h3 className="font-medium text-graphite dark:text-paper mb-1" style={{ fontSize: "1.125rem", letterSpacing: "-0.015em" }}>
              {owner.user?.firstName} {owner.user?.lastName}
            </h3>
            <StatusBadge status={owner.status} />
          </div>

          {/* Info */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Owner ID',       value: owner.id },
              { label: 'Email',          value: owner.user?.email || '—' },
              { label: 'Phone',          value: owner.user?.phone || '—' },
              { label: 'Ghana Card',     value: owner.ghanaCardNumber || '—' },
              { label: 'Region',         value: owner.region || '—' },
              { label: 'MoMo Provider',  value: owner.momoProvider || '—' },
              { label: 'MoMo Number',    value: owner.momoNumber || '—' },
              { label: 'Bank',           value: owner.bankName || '—' },
              { label: 'Vehicles',       value: owner._count?.vehicles ?? '—' },
              { label: 'Registered',     value: fmt(owner.createdAt) },
              { label: 'Verified At',    value: owner.verifiedAt ? fmt(owner.verifiedAt) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {/* Status actions */}
          <div>
            <p className="text-xs font-medium text-fog uppercase tracking-widest mb-3">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {OWNER_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={loading || owner.status === s}
                  onClick={() => handleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                    owner.status === s
                      ? 'border-neutral-600 text-neutral-400 cursor-default'
                      : s === 'VERIFIED' || s === 'ACTIVE' ? 'border-success/40 text-success hover:bg-success/10'
                      : s === 'SUSPENDED' ? 'border-warning/40 text-warning hover:bg-warning/10'
                      : s === 'INACTIVE'  ? 'border-danger/40 text-danger hover:bg-danger/10'
                      : 'border-neutral-200 dark:border-dark-border text-neutral-400 hover:bg-chalk dark:hover:bg-dark-elevated'
                  }`}
                >
                  {loading ? '…' : owner.status === s ? `✓ ${s.replace(/_/g, ' ')}` : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminOwnersPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [owners, setOwners]         = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listOwners({ page, limit: 20, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setOwners(res.data.data.owners);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (updated) => {
    setOwners((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelected((prev) => prev?.id === updated.id ? updated : prev);
  };

  const COLS = [
    {
      key: 'name', label: 'Name',
      render: (o) => (
        <span className="text-neutral-900 dark:text-graphite dark:text-paper font-medium">{o.user?.firstName} {o.user?.lastName}</span>
      ),
    },
    {
      key: 'contact', label: 'Contact', hidden: 'hidden sm:table-cell',
      render: (o) => <span className="text-neutral-400 text-xs">{o.user?.email || o.user?.phone || '—'}</span>,
    },
    {
      key: 'vehicles', label: 'Vehicles',
      render: (o) => <span className="text-neutral-300 text-xs">{o._count?.vehicles ?? 0}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: 'createdAt', label: 'Registered', hidden: 'hidden lg:table-cell',
      render: (o) => <span className="text-neutral-500 text-xs">{fmt(o.createdAt)}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Owners</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} owner profile${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, email or phone…"
          className="input flex-1"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input w-52"
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {OWNER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={owners} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <OwnerDrawer
          owner={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}
