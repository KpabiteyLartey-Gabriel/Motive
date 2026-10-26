'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const COMPANY_TYPES = [
  'TRANSPORT',
  'FLEET_MANAGEMENT',
  'VEHICLE_PLACEMENT',
  'MAINTENANCE',
];

const COMPANY_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

const TYPE_LABELS = {
  TRANSPORT:                 'Transport',
  FLEET_MANAGEMENT:          'Fleet Management',
  VEHICLE_PLACEMENT:         'Vehicle Placement',
  MAINTENANCE:               'Maintenance',
};

function TypeBadge({ type }) {
  const label = TYPE_LABELS[type] || type;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium bg-accent/10 text-accent">
      {label}
    </span>
  );
}

function CompanyDrawer({ company, onClose, onStatusChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleStatus = async (status) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.updateCompanyStatus(company.id, status);
      onStatusChange({ ...company, ...res.data.data });
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
          <h2 className="text-base font-medium text-graphite dark:text-paper">Company Details</h2>
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
            <h3 className="text-lg font-bold text-white mb-2">{company.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <TypeBadge type={company.type} />
              <StatusBadge status={company.status} />
            </div>
          </div>

          {/* Info */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Company ID',      value: company.id },
              { label: 'Email',           value: company.email || '—' },
              { label: 'Phone',           value: company.phone || '—' },
              { label: 'Reg. Number',     value: company.registrationNumber || '—' },
              { label: 'TIN',             value: company.tinNumber || '—' },
              { label: 'Region',          value: company.region || '—' },
              { label: 'Members',         value: company._count?.members ?? '—' },
              { label: 'Vehicles',        value: company._count?.vehicles ?? '—' },
              { label: 'Registered',      value: fmt(company.createdAt) },
              { label: 'Verified At',     value: company.verifiedAt ? fmt(company.verifiedAt) : '—' },
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
              {COMPANY_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={loading || company.status === s}
                  onClick={() => handleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                    company.status === s
                      ? 'border-neutral-600 text-neutral-400 cursor-default'
                      : s === 'ACTIVE'      ? 'border-success/40 text-success hover:bg-success/10'
                      : s === 'SUSPENDED'   ? 'border-warning/40 text-warning hover:bg-warning/10'
                      : s === 'DEACTIVATED' ? 'border-danger/40 text-danger hover:bg-danger/10'
                      : 'border-neutral-200 dark:border-dark-border text-neutral-400 hover:bg-chalk dark:hover:bg-dark-elevated'
                  }`}
                >
                  {loading ? '…' : company.status === s ? `✓ ${s.replace(/_/g, ' ')}` : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminCompaniesPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [companies, setCompanies]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [typeFilter, setType]       = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listCompanies({
        page, limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      })
      .then((res) => {
        setCompanies(res.data.data.companies);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, search, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (updated) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelected((prev) => prev?.id === updated.id ? updated : prev);
  };

  const COLS = [
    {
      key: 'name', label: 'Name',
      render: (c) => <span className="text-neutral-900 dark:text-graphite dark:text-paper font-medium">{c.name}</span>,
    },
    {
      key: 'type', label: 'Type',
      render: (c) => <TypeBadge type={c.type} />,
    },
    {
      key: 'members', label: 'Members',
      render: (c) => <span className="text-neutral-300 text-xs">{c._count?.members ?? 0}</span>,
    },
    {
      key: 'vehicles', label: 'Vehicles',
      render: (c) => <span className="text-neutral-300 text-xs">{c._count?.vehicles ?? 0}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'createdAt', label: 'Registered', hidden: 'hidden lg:table-cell',
      render: (c) => <span className="text-neutral-500 text-xs">{fmt(c.createdAt)}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Companies</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} compan${pagination.total !== 1 ? 'ies' : 'y'}` : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, email or registration…"
          className="input flex-1"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input w-44"
          value={typeFilter}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          {COMPANY_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          className="input w-44"
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {COMPANY_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={companies} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && (
        <CompanyDrawer
          company={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}
