'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi } from '@/lib/api';

const COMPLIANCE_STATUSES  = ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL'];
const COMPLIANCE_DOC_TYPES = ['INSURANCE', 'ROADWORTHINESS', 'VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'BUSINESS_LICENSE', 'OTHER'];

function statusColor(status) {
  if (status === 'VALID') return 'text-success bg-success/10 border-success/20';
  if (status === 'EXPIRING_SOON') return 'text-warning bg-warning/10 border-warning/20';
  if (status === 'EXPIRED') return 'text-danger bg-danger/10 border-danger/20';
  return 'text-neutral-400 bg-neutral-800 border-neutral-700';
}

function ComplianceBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium border ${statusColor(status)}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function ComplianceDrawer({ record, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Compliance Record</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 px-6 py-6 space-y-6">
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-2">{record.id}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <ComplianceBadge status={record.status} />
              <span className="text-xs text-neutral-400">{record.documentType?.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Document Type',   value: record.documentType?.replace(/_/g, ' ') || '—' },
              { label: 'Document Number', value: record.documentNumber || '—' },
              { label: 'Issuer',          value: record.issuer || '—' },
              { label: 'Issue Date',      value: record.issueDate ? fmt(record.issueDate) : '—' },
              { label: 'Expiry Date',     value: record.expiryDate ? fmt(record.expiryDate) : '—' },
              { label: 'Vehicle ID',      value: record.vehicleId || '—' },
              { label: 'Driver ID',       value: record.driverId || '—' },
              { label: 'Last Checked',    value: record.lastCheckedAt ? fmt(record.lastCheckedAt) : '—' },
              { label: 'Notes',           value: record.notes || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>

          {record.fileUrl && (
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-2">Document File</p>
              <p className="text-xs text-accent">{record.fileName || record.fileUrl}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminCompliancePage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [records, setRecords]       = useState([]);
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
      .listCompliance({ page, limit: 20, status: statusFilter || undefined, documentType: typeFilter || undefined })
      .then((res) => {
        setRecords(res.data.data.records);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-chalk flex items-center justify-center">
      <div className="text-neutral-500 text-sm">Loading…</div>
    </div>
  );

  const COLS = [
    {
      key: 'documentType', label: 'Document Type',
      render: (r) => <span className="text-white text-xs">{r.documentType?.replace(/_/g, ' ') || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <ComplianceBadge status={r.status} />,
    },
    {
      key: 'vehicleId', label: 'Entity', hidden: 'hidden sm:table-cell',
      render: (r) => (
        <span className="text-neutral-400 text-xs">
          {r.vehicleId ? `Vehicle: ${r.vehicleId.slice(0, 8)}…` : r.driverId ? `Driver: ${r.driverId.slice(0, 8)}…` : '—'}
        </span>
      ),
    },
    {
      key: 'expiryDate', label: 'Expires',
      render: (r) => (
        <span className={`text-xs ${r.status === 'EXPIRED' ? 'text-danger' : r.status === 'EXPIRING_SOON' ? 'text-warning' : 'text-neutral-400'}`}>
          {r.expiryDate ? fmt(r.expiryDate) : '—'}
        </span>
      ),
    },
    {
      key: 'documentNumber', label: 'Doc Number', hidden: 'hidden lg:table-cell',
      render: (r) => <span className="text-neutral-500 text-xs font-mono">{r.documentNumber || '—'}</span>,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Compliance</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {pagination ? `${pagination.total} compliance record${pagination.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select className="input w-52" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {COMPLIANCE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input w-52" value={typeFilter} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {COMPLIANCE_DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
        <AdminTable columns={COLS} rows={records} loading={fetching} onRowClick={setSelected} />
      </div>
      <AdminPagination pagination={pagination} page={page} setPage={setPage} />

      {selected && <ComplianceDrawer record={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
